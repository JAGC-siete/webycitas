import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuiteApi } from '../../../lib/suite/tenant'
import { hondurasTodayDate } from '../../../lib/suite/schemas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const ctx = await requireSuiteApi(req, res, { module: 'reservas' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Todavía no tenés un sitio publicado' })

  const siteId = ctx.tenant.site.id
  const day = typeof req.query.day === 'string' ? req.query.day : hondurasTodayDate()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data: summary, error: summaryError } = await ctx.supabase.rpc('suite_day_summary', {
      p_site_id: siteId,
      p_day: day,
    })
    if (summaryError) throw summaryError

    const [{ data: inquiries }, { data: cancelled }] = await Promise.all([
      ctx.supabase
        .from('site_inquiries')
        .select('id, full_name, phone, email, message, created_at')
        .eq('site_id', siteId)
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(20),
      ctx.supabase
        .from('appointments')
        .select('id, starts_at, notes, customers(name)')
        .eq('site_id', siteId)
        .eq('status', 'cancelled')
        .gte('updated_at', since24h)
        .order('updated_at', { ascending: false })
        .limit(10),
    ])

    const alerts = [
      ...(inquiries ?? []).map((row) => ({
        type: 'inquiry' as const,
        id: row.id,
        title: `Nueva solicitud: ${row.full_name}`,
        at: row.created_at,
      })),
      ...(cancelled ?? []).map((row) => {
        const customer = row.customers as { name?: string } | { name?: string }[] | null
        const name = Array.isArray(customer) ? customer[0]?.name : customer?.name
        return {
          type: 'cancellation' as const,
          id: row.id,
          title: `Cancelación: ${name || 'cita'}`,
          at: row.starts_at,
        }
      }),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

    return res.status(200).json({
      day,
      summary: summary ?? {
        appointments_today: 0,
        open_minutes: 0,
        revenue_cents: 0,
        cancellations_24h: 0,
      },
      alerts,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar el panel'
    return res.status(500).json({ error: message })
  }
}
