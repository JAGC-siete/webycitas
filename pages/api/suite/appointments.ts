import type { NextApiRequest, NextApiResponse } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSuiteApi } from '../../../lib/suite/tenant'
import {
  addMinutesIso,
  appointmentCreateSchema,
  appointmentPatchSchema,
} from '../../../lib/suite/schemas'

async function upsertCustomer(
  supabase: SupabaseClient,
  siteId: string,
  input: { name: string; phone?: string | null; email?: string | null }
) {
  const phone = input.phone?.trim() || null
  if (phone) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('site_id', siteId)
      .eq('phone', phone)
      .maybeSingle()
    if (existing) {
      await supabase
        .from('customers')
        .update({
          name: input.name,
          email: input.email || null,
        })
        .eq('id', existing.id)
      return existing.id as string
    }
  }
  const { data, error } = await supabase
    .from('customers')
    .insert({
      site_id: siteId,
      name: input.name,
      phone,
      email: input.email || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'reservas' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  const siteId = ctx.tenant.site.id

  try {
    if (req.method === 'GET') {
      const from = typeof req.query.from === 'string' ? req.query.from : null
      const to = typeof req.query.to === 'string' ? req.query.to : null
      let query = ctx.supabase
        .from('appointments')
        .select(
          'id, starts_at, ends_at, status, source, notes, staff_id, service_id, customer_id, customers(name, phone), staff_members(name, color), bookable_services(name, price_cents, duration_min)'
        )
        .eq('site_id', siteId)
        .order('starts_at', { ascending: true })
      if (from) query = query.gte('starts_at', from)
      if (to) query = query.lt('starts_at', to)
      const { data, error } = await query.limit(500)
      if (error) throw error
      return res.status(200).json({ appointments: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = appointmentCreateSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const body = parsed.data

      let endsAt = body.ends_at
      if (!endsAt && body.service_id) {
        const { data: service } = await ctx.supabase
          .from('bookable_services')
          .select('duration_min, buffer_min')
          .eq('id', body.service_id)
          .maybeSingle()
        const mins = (service?.duration_min ?? 30) + (service?.buffer_min ?? 0)
        endsAt = addMinutesIso(body.starts_at, mins)
      }
      if (!endsAt) endsAt = addMinutesIso(body.starts_at, 30)

      const customerId = await upsertCustomer(ctx.supabase, siteId, {
        name: body.customer_name,
        phone: body.customer_phone,
        email: body.customer_email || null,
      })

      const { data, error } = await ctx.supabase
        .from('appointments')
        .insert({
          site_id: siteId,
          customer_id: customerId,
          staff_id: body.staff_id || null,
          service_id: body.service_id || null,
          starts_at: body.starts_at,
          ends_at: endsAt,
          status: body.status || 'confirmed',
          source: body.source || 'manual',
          notes: body.notes || null,
        })
        .select('*')
        .single()
      if (error) {
        if (error.message.includes('appointments_no_staff_overlap')) {
          return res.status(409).json({ error: 'Ese horario ya está ocupado' })
        }
        throw error
      }
      return res.status(201).json({ appointment: data })
    }

    if (req.method === 'PATCH') {
      const parsed = appointmentPatchSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const { id, ...patch } = parsed.data
      const { data, error } = await ctx.supabase
        .from('appointments')
        .update(patch)
        .eq('id', id)
        .eq('site_id', siteId)
        .select('*')
        .maybeSingle()
      if (error) {
        if (error.message.includes('appointments_no_staff_overlap')) {
          return res.status(409).json({ error: 'Ese horario ya está ocupado' })
        }
        throw error
      }
      if (!data) return res.status(404).json({ error: 'Cita no encontrada' })
      return res.status(200).json({ appointment: data })
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en citas'
    return res.status(500).json({ error: message })
  }
}
