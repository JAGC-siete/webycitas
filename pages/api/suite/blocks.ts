import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuiteApi } from '../../../lib/suite/tenant'
import { blockCreateSchema } from '../../../lib/suite/schemas'

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
        .from('schedule_blocks')
        .select('id, staff_id, starts_at, ends_at, reason')
        .eq('site_id', siteId)
        .order('starts_at', { ascending: true })
      if (from) query = query.gte('starts_at', from)
      if (to) query = query.lt('starts_at', to)
      const { data, error } = await query.limit(200)
      if (error) throw error
      return res.status(200).json({ blocks: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = blockCreateSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const { data, error } = await ctx.supabase
        .from('schedule_blocks')
        .insert({
          site_id: siteId,
          staff_id: parsed.data.staff_id || null,
          starts_at: parsed.data.starts_at,
          ends_at: parsed.data.ends_at,
          reason: parsed.data.reason || null,
        })
        .select('*')
        .single()
      if (error) throw error
      return res.status(201).json({ block: data })
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : req.body?.id
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Falta id' })
      const { error } = await ctx.supabase.from('schedule_blocks').delete().eq('id', id).eq('site_id', siteId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en bloqueos'
    return res.status(500).json({ error: message })
  }
}
