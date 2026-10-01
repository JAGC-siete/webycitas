import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuiteApi } from '../../../../lib/suite/tenant'
import { addMinutesIso, convertInquirySchema } from '../../../../lib/suite/schemas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const ctx = await requireSuiteApi(req, res, { module: 'reservas' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  const siteId = ctx.tenant.site.id

  const parsed = convertInquirySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })

  try {
    const { data: inquiry, error } = await ctx.supabase
      .from('site_inquiries')
      .select('id, full_name, email, phone, message')
      .eq('id', parsed.data.inquiry_id)
      .eq('site_id', siteId)
      .maybeSingle()
    if (error) throw error
    if (!inquiry) return res.status(404).json({ error: 'Solicitud no encontrada' })

    let customerId: string | null = null
    const phone = inquiry.phone?.trim() || null
    if (phone) {
      const { data: existing } = await ctx.supabase
        .from('customers')
        .select('id')
        .eq('site_id', siteId)
        .eq('phone', phone)
        .maybeSingle()
      if (existing) customerId = existing.id
    }
    if (!customerId) {
      const { data: created, error: createError } = await ctx.supabase
        .from('customers')
        .insert({
          site_id: siteId,
          name: inquiry.full_name,
          phone,
          email: inquiry.email,
          notes: inquiry.message,
        })
        .select('id')
        .single()
      if (createError) throw createError
      customerId = created.id
    }

    let endsAt = parsed.data.ends_at
    if (!endsAt && parsed.data.service_id) {
      const { data: service } = await ctx.supabase
        .from('bookable_services')
        .select('duration_min, buffer_min')
        .eq('id', parsed.data.service_id)
        .maybeSingle()
      endsAt = addMinutesIso(
        parsed.data.starts_at,
        (service?.duration_min ?? 30) + (service?.buffer_min ?? 0)
      )
    }
    if (!endsAt) endsAt = addMinutesIso(parsed.data.starts_at, 30)

    const { data: appointment, error: apptError } = await ctx.supabase
      .from('appointments')
      .insert({
        site_id: siteId,
        customer_id: customerId,
        staff_id: parsed.data.staff_id || null,
        service_id: parsed.data.service_id || null,
        inquiry_id: inquiry.id,
        starts_at: parsed.data.starts_at,
        ends_at: endsAt,
        status: 'confirmed',
        source: 'inquiry',
        notes: inquiry.message,
      })
      .select('*')
      .single()
    if (apptError) {
      if (apptError.message.includes('appointments_no_staff_overlap')) {
        return res.status(409).json({ error: 'Ese horario ya está ocupado' })
      }
      throw apptError
    }

    return res.status(201).json({ appointment })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo convertir'
    return res.status(500).json({ error: message })
  }
}
