import { z } from 'zod'

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

/** Etiqueta para el owner y verbo del botón que lleva a ese estado. */
export const APPOINTMENT_STATUS_COPY: Record<AppointmentStatus, { label: string; action: string }> = {
  pending: { label: 'Pendiente', action: 'Marcar pendiente' },
  confirmed: { label: 'Confirmada', action: 'Confirmar' },
  completed: { label: 'Atendida', action: 'Marcar atendida' },
  cancelled: { label: 'Cancelada', action: 'Cancelar' },
  no_show: { label: 'No vino', action: 'No vino' },
}

export function appointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_COPY[status as AppointmentStatus]?.label ?? status
}

export const APPOINTMENT_SOURCES =['manual', 'walk_in', 'inquiry', 'web'] as const

export const appointmentCreateSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(7).max(30).optional().nullable(),
  customer_email: z.string().trim().email().optional().nullable().or(z.literal('')),
  staff_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  source: z.enum(APPOINTMENT_SOURCES).optional(),
  notes: z.string().max(1000).optional().nullable(),
})

export const appointmentPatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  staff_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export const blockCreateSchema = z.object({
  staff_id: z.string().uuid().optional().nullable(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  reason: z.string().max(200).optional().nullable(),
})

export const staffCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  bio: z.string().max(500).optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
  is_active: z.boolean().optional(),
  service_ids: z.array(z.string().uuid()).optional(),
  schedules: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
        end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      })
    )
    .optional(),
})

export const staffPatchSchema = staffCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export const serviceUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  price_cents: z.number().int().min(0).max(999999999),
  duration_min: z.number().int().min(5).max(480),
  buffer_min: z.number().int().min(0).max(120).optional(),
  is_active: z.boolean().optional(),
})

export const customerPatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(30).nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal('')),
  notes: z.string().max(1000).nullable().optional(),
})

export const convertInquirySchema = z.object({
  inquiry_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).optional(),
  staff_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
})

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function formatLempirasFromCents(cents: number): string {
  const value = cents / 100
  return `L. ${value.toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function hondurasTodayDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tegucigalpa' })
}
