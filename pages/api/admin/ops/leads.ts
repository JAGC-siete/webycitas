import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireOpsAdminApi } from '../../../../lib/ops/admin-auth'
import { createAdminClient } from '../../../../lib/supabase/admin'

const LEAD_COLUMNS =
  'id, owner_name, business_name, email, phone, rubro, city, services, status, preview_slug, site_id, created_at'

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['received', 'reviewed', 'rejected']),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const operator = requireOpsAdminApi(req, res)
  if (!operator) return

  try {
    const db = createAdminClient()
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('leads')
        .select(LEAD_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return res.status(200).json({ leads: data ?? [] })
    }

    if (req.method === 'PATCH') {
      const parsed = patchSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const { data, error } = await db
        .from('leads')
        .update({ status: parsed.data.status })
        .eq('id', parsed.data.id)
        .select(LEAD_COLUMNS)
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Lead no encontrado' })
      return res.status(200).json({ lead: data })
    }

    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron leer los leads'
    return res.status(500).json({ error: message })
  }
}
