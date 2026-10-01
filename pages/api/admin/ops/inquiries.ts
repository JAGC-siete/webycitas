import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuperAdmin } from '../../../../lib/auth/api-auth'
import { createAdminClient } from '../../../../lib/supabase/admin'

type SiteJoin = { slug: string; title: string } | { slug: string; title: string }[] | null

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  const operator = await requireSuperAdmin(req, res, 'inquiries_list')
  if (!operator) return

  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('site_inquiries')
      .select('id, site_id, full_name, email, phone, message, source, created_at, sites(slug, title)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    const inquiries = (data ?? []).map((row) => {
      const joined = row.sites as SiteJoin
      const site = Array.isArray(joined) ? joined[0] ?? null : joined
      const { sites: _sites, ...rest } = row
      return { ...rest, site }
    })
    return res.status(200).json({ inquiries })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron leer las consultas'
    return res.status(500).json({ error: message })
  }
}
