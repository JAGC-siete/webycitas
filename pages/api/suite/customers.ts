import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuiteApi } from '../../../lib/suite/tenant'
import { customerPatchSchema } from '../../../lib/suite/schemas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'reservas' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  const siteId = ctx.tenant.site.id

  try {
    if (req.method === 'GET') {
      if (req.query.export === 'csv') {
        const { data, error } = await ctx.supabase
          .from('customers')
          .select('name, phone, email, notes, created_at')
          .eq('site_id', siteId)
          .order('name', { ascending: true })
          .limit(5000)
        if (error) throw error
        const header = 'name,phone,email,notes,created_at'
        const rows = (data ?? []).map((row) =>
          [row.name, row.phone ?? '', row.email ?? '', row.notes ?? '', row.created_at]
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(',')
        )
        const csv = `\uFEFF${[header, ...rows].join('\n')}`
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="clientes.csv"')
        return res.status(200).send(csv)
      }

      if (typeof req.query.id === 'string') {
        const id = req.query.id
        const [{ data: customer, error }, { data: history }] = await Promise.all([
          ctx.supabase.from('customers').select('*').eq('id', id).eq('site_id', siteId).maybeSingle(),
          ctx.supabase
            .from('appointments')
            .select(
              'id, starts_at, ends_at, status, staff_members(name), bookable_services(name, price_cents)'
            )
            .eq('site_id', siteId)
            .eq('customer_id', id)
            .order('starts_at', { ascending: false })
            .limit(100),
        ])
        if (error) throw error
        if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' })
        return res.status(200).json({ customer, history: history ?? [] })
      }

      const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
      let query = ctx.supabase
        .from('customers')
        .select('*')
        .eq('site_id', siteId)
        .order('name', { ascending: true })
        .limit(200)
      if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      const { data, error } = await query
      if (error) throw error
      return res.status(200).json({ customers: data ?? [] })
    }

    if (req.method === 'PATCH') {
      const parsed = customerPatchSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const { id, ...rest } = parsed.data
      const patch: Record<string, unknown> = {}
      if (rest.name !== undefined) patch.name = rest.name
      if (rest.phone !== undefined) patch.phone = rest.phone
      if (rest.email !== undefined) patch.email = rest.email || null
      if (rest.notes !== undefined) patch.notes = rest.notes
      const { data, error } = await ctx.supabase
        .from('customers')
        .update(patch)
        .eq('id', id)
        .eq('site_id', siteId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Cliente no encontrado' })
      return res.status(200).json({ customer: data })
    }

    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en clientes'
    return res.status(500).json({ error: message })
  }
}
