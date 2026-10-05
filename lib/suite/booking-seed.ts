/**
 * Seed de staff + horarios + servicios al publicar un site con módulo booking.
 * Idempotente: no inserta si el site ya tiene staff o bookable_services.
 */

import {
  DEMO_LOCAL_CATALOGS,
  type DemoLocalCatalogItem,
  type DemoLocalLead,
  type DemoLocalRubro,
} from '../magnet/demo-local'
import { logger } from '../logger'

type AdminClient = ReturnType<typeof import('../supabase/admin').createAdminClient>

/** Extrae el primer monto de strings tipo "L. 150", "Desde L. 700", "L. 1,250". */
export function parseLempirasToCents(price: string): number {
  const match = price.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  if (!match) return 0
  const value = Number(match[1])
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(Math.round(value * 100), 999_999_999)
}

/** Extrae minutos de "30 min", "Cita de 20 min"; default 30. */
export function parseDurationMinFromDetail(detail: string): number {
  const match = detail.match(/(\d+)\s*min/i)
  if (!match) return 30
  const n = Number(match[1])
  if (!Number.isFinite(n) || n < 5 || n > 480) return 30
  return n
}

export function catalogItemsForRubro(rubro: string): DemoLocalCatalogItem[] {
  const catalog = DEMO_LOCAL_CATALOGS[rubro as DemoLocalRubro]
  return catalog?.items ?? DEMO_LOCAL_CATALOGS.barberia.items
}

/** Lun–Sáb (1–6), 09:00–18:00 America/Tegucigalpa. */
export const DEFAULT_BOOKING_SCHEDULES = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  start_time: '09:00:00',
  end_time: '18:00:00',
}))

export async function seedBookingCatalogForSite(params: {
  adminClient: AdminClient
  siteId: string
  lead: DemoLocalLead
}): Promise<{ seeded: boolean; reason?: string }> {
  if (!params.lead.services.includes('booking')) {
    return { seeded: false, reason: 'no_booking' }
  }

  const [{ count: staffCount, error: staffErr }, { count: serviceCount, error: svcErr }] =
    await Promise.all([
      params.adminClient
        .from('staff_members')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', params.siteId),
      params.adminClient
        .from('bookable_services')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', params.siteId),
    ])

  if (staffErr || svcErr) {
    logger.warn('No se pudo verificar seed booking', {
      siteId: params.siteId,
      error: staffErr?.message ?? svcErr?.message,
    })
    return { seeded: false, reason: 'check_failed' }
  }

  if ((staffCount ?? 0) > 0 || (serviceCount ?? 0) > 0) {
    return { seeded: false, reason: 'already_seeded' }
  }

  const staffName = params.lead.businessName.trim().slice(0, 80) || 'Equipo'
  const { data: staff, error: createStaffError } = await params.adminClient
    .from('staff_members')
    .insert({
      site_id: params.siteId,
      name: staffName,
      color: '#38bdf8',
      is_active: true,
      sort_order: 0,
    })
    .select('id')
    .single()

  if (createStaffError || !staff) {
    logger.error('No se pudo seedear staff', {
      siteId: params.siteId,
      error: createStaffError?.message,
    })
    return { seeded: false, reason: 'staff_failed' }
  }

  const { error: scheduleError } = await params.adminClient.from('staff_schedules').insert(
    DEFAULT_BOOKING_SCHEDULES.map((row) => ({
      staff_id: staff.id,
      weekday: row.weekday,
      start_time: row.start_time,
      end_time: row.end_time,
    }))
  )
  if (scheduleError) {
    logger.warn('Staff creado sin horarios', {
      siteId: params.siteId,
      error: scheduleError.message,
    })
  }

  const items = catalogItemsForRubro(params.lead.rubro)
  const servicesPayload = items.map((item, index) => ({
    site_id: params.siteId,
    name: item.name.slice(0, 120),
    price_cents: parseLempirasToCents(item.price),
    duration_min: parseDurationMinFromDetail(item.detail),
    buffer_min: 0,
    is_active: true,
    sort_order: index,
  }))

  const { data: services, error: servicesError } = await params.adminClient
    .from('bookable_services')
    .insert(servicesPayload)
    .select('id')

  if (servicesError) {
    logger.error('No se pudo seedear servicios', {
      siteId: params.siteId,
      error: servicesError.message,
    })
    return { seeded: false, reason: 'services_failed' }
  }

  if (services && services.length > 0) {
    const { error: linkError } = await params.adminClient.from('staff_services').insert(
      services.map((svc) => ({
        staff_id: staff.id,
        service_id: svc.id,
      }))
    )
    if (linkError) {
      logger.warn('Servicios sin vínculo staff_services', {
        siteId: params.siteId,
        error: linkError.message,
      })
    }
  }

  logger.info('Booking catalog seeded', {
    siteId: params.siteId,
    staffId: staff.id,
    services: services?.length ?? 0,
  })
  return { seeded: true }
}
