import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuiteApi } from '../../../../lib/suite/tenant'

/** Inbox de solicitudes web para convertir a citas. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  const ctx = await requireSuiteApi(req, res, { module: 'reservas' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  try {
    const { data: inquiries, error } = await ctx.supabase
      .from('site_inquiries')
      .select('id, full_name, phone, email, message, created_at')
      .eq('site_id', ctx.tenant.site.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error

    const { data: converted } = await ctx.supabase
      .from('appointments')
      .select('inquiry_id')
      .eq('site_id', ctx.tenant.site.id)
      .not('inquiry_id', 'is', null)

    const used = new Set(
      (converted ?? []).map((r: { inquiry_id: string | null }) => r.inquiry_id as string)
    )
    const open = (inquiries ?? []).filter(
      (row: { id: string }) => !used.has(row.id)
    )
    return res.status(200).json({ inquiries: open })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron leer solicitudes'
    return res.status(500).json({ error: message })
  }
}
