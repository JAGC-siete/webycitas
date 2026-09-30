import type { NextApiRequest, NextApiResponse } from 'next'
import { requireOpsAdminApi } from '../../../../lib/ops/admin-auth'
import { createAdminClient } from '../../../../lib/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  const operator = requireOpsAdminApi(req, res)
  if (!operator) return

  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('sites')
      .select('id, lead_id, title, slug, template_type, status, published_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return res.status(200).json({ sites: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron leer los sites'
    return res.status(500).json({ error: message })
  }
}
