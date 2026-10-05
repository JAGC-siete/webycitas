import type { NextApiRequest, NextApiResponse } from 'next'
import { landingPublicPath } from '../../../lib/landings/paths'
import { requireSuiteApi } from '../../../lib/suite/tenant'
import { hondurasTodayDate } from '../../../lib/suite/schemas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  // Panel "Hoy" es para todo owner con sesión — no exige módulo reservas.
  const ctx = await requireSuiteApi(req, res)
  if (!ctx) return

  const hasBooking = ctx.tenant.modules.includes('reservas')
  const site = ctx.tenant.site
  const day = typeof req.query.day === 'string' ? req.query.day : hondurasTodayDate()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    if (!site) {
      return res.status(200).json({
        day,
        modules: ctx.tenant.modules,
        site: null,
        landing: null,
        summary: null,
        alerts: [],
      })
    }

    const [
      { count: inquiries24h, error: err24 },
      { count: inquiries7d, error: err7 },
      { data: recentInquiries, error: errRecent },
    ] = await Promise.all([
      ctx.supabase
        .from('site_inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', site.id)
        .gte('created_at', since24h),
      ctx.supabase
        .from('site_inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', site.id)
        .gte('created_at', since7d),
      ctx.supabase
        .from('site_inquiries')
        .select('id, full_name, phone, email, message, created_at')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(8),
    ])
    if (err24) throw err24
    if (err7) throw err7
    if (errRecent) throw errRecent

    const inquiryAlerts = (recentInquiries ?? [])
      .filter((row) => new Date(row.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
      .map((row) => ({
        type: 'inquiry' as const,
        id: row.id,
        title: `Nueva solicitud: ${row.full_name}`,
        at: row.created_at,
      }))

    let summary: {
      appointments_today: number
      open_minutes: number
      revenue_cents: number
      cancellations_24h: number
    } | null = null
    let cancellationAlerts: { type: 'cancellation'; id: string; title: string; at: string }[] = []

    if (hasBooking) {
      const { data: daySummary, error: summaryError } = await ctx.supabase.rpc('suite_day_summary', {
        p_site_id: site.id,
        p_day: day,
      })
      if (summaryError) throw summaryError
      summary = daySummary ?? {
        appointments_today: 0,
        open_minutes: 0,
        revenue_cents: 0,
        cancellations_24h: 0,
      }

      const { data: cancelled } = await ctx.supabase
        .from('appointments')
        .select('id, starts_at, notes, customers(name)')
        .eq('site_id', site.id)
        .eq('status', 'cancelled')
        .gte('updated_at', since24h)
        .order('updated_at', { ascending: false })
        .limit(10)

      cancellationAlerts = (cancelled ?? []).map((row) => {
        const customer = row.customers as { name?: string } | { name?: string }[] | null
        const name = Array.isArray(customer) ? customer[0]?.name : customer?.name
        return {
          type: 'cancellation' as const,
          id: row.id,
          title: `Cancelación: ${name || 'cita'}`,
          at: row.starts_at,
        }
      })
    }

    const alerts = [...inquiryAlerts, ...cancellationAlerts].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    )

    return res.status(200).json({
      day,
      modules: ctx.tenant.modules,
      site: {
        id: site.id,
        slug: site.slug,
        title: site.title,
        status: site.status,
        publishedAt: site.publishedAt,
        updatedAt: site.updatedAt,
        publicPath: landingPublicPath(site.slug),
      },
      landing: {
        inquiries_24h: inquiries24h ?? 0,
        inquiries_7d: inquiries7d ?? 0,
        recent: (recentInquiries ?? []).map((row) => ({
          id: row.id,
          full_name: row.full_name,
          created_at: row.created_at,
        })),
      },
      summary,
      alerts,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar el panel'
    return res.status(500).json({ error: message })
  }
}
