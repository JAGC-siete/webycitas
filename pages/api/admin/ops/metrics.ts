import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuperAdmin } from '../../../../lib/auth/api-auth'
import { createAdminClient } from '../../../../lib/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  const operator = await requireSuperAdmin(req, res, 'metrics')
  if (!operator) return

  try {
    const db = createAdminClient()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [leadsRes, sitesRes, inquiries24h, inquiries7d, ownersRes] = await Promise.all([
      db.from('leads').select('status'),
      db.from('sites').select('status'),
      db.from('site_inquiries').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
      db.from('site_inquiries').select('id', { count: 'exact', head: true }).gte('created_at', since7d),
      db.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner').eq('is_active', true),
    ])

    if (leadsRes.error) throw leadsRes.error
    if (sitesRes.error) throw sitesRes.error
    if (inquiries24h.error) throw inquiries24h.error
    if (inquiries7d.error) throw inquiries7d.error
    if (ownersRes.error) throw ownersRes.error

    const leadsByStatus = { received: 0, reviewed: 0, rejected: 0 }
    for (const row of leadsRes.data ?? []) {
      const status = row.status as keyof typeof leadsByStatus
      if (status in leadsByStatus) leadsByStatus[status] += 1
    }

    const sitesByStatus: Record<string, number> = {}
    for (const row of sitesRes.data ?? []) {
      const status = String(row.status)
      sitesByStatus[status] = (sitesByStatus[status] ?? 0) + 1
    }

    return res.status(200).json({
      leads: {
        ...leadsByStatus,
        total: (leadsRes.data ?? []).length,
      },
      sites: {
        by_status: sitesByStatus,
        total: (sitesRes.data ?? []).length,
      },
      inquiries: {
        last_24h: inquiries24h.count ?? 0,
        last_7d: inquiries7d.count ?? 0,
      },
      owners_active: ownersRes.count ?? 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron leer las métricas'
    return res.status(500).json({ error: message })
  }
}
