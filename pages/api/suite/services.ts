import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuiteApi } from '../../../lib/suite/tenant'
import { serviceUpsertSchema } from '../../../lib/suite/schemas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res)
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  const siteId = ctx.tenant.site.id
  const hasBooking = ctx.tenant.modules.includes('reservas')
  const hasSitio = ctx.tenant.modules.includes('sitio')
  if (!hasBooking && !hasSitio) {
    return res.status(403).json({ error: 'Módulo no activo', code: 'MODULE_NOT_ENABLED' })
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await ctx.supabase
        .from('bookable_services')
        .select('*')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return res.status(200).json({ services: data ?? [] })
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const parsed = serviceUpsertSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const body = parsed.data

      if (req.method === 'POST' || !body.id) {
        const { data, error } = await ctx.supabase
          .from('bookable_services')
          .insert({
            site_id: siteId,
            name: body.name,
            price_cents: body.price_cents,
            duration_min: body.duration_min,
            buffer_min: body.buffer_min ?? 0,
            is_active: body.is_active ?? true,
          })
          .select('*')
          .single()
        if (error) throw error
        return res.status(201).json({ service: data })
      }

      const { data, error } = await ctx.supabase
        .from('bookable_services')
        .update({
          name: body.name,
          price_cents: body.price_cents,
          duration_min: body.duration_min,
          buffer_min: body.buffer_min ?? 0,
          is_active: body.is_active ?? true,
        })
        .eq('id', body.id)
        .eq('site_id', siteId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Servicio no encontrado' })
      return res.status(200).json({ service: data })
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : req.body?.id
      if (!id) return res.status(400).json({ error: 'Falta id' })
      const { error } = await ctx.supabase.from('bookable_services').delete().eq('id', id).eq('site_id', siteId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en servicios'
    return res.status(500).json({ error: message })
  }
}
