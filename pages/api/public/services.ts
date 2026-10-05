import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../lib/logger'
import { createAdminClient } from '../../../lib/supabase/admin'
import { resolvePublishedSiteBySlug } from '../../../lib/suite/public-booking'
import { PUBLIC_LEAD_LIMIT, withRateLimit } from '../../../lib/rate-limit'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Método no permitido' })
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug.trim().toLowerCase() : ''
  if (!slug || slug.length < 3) {
    return res.status(400).json({ success: false, error: 'Página no válida.' })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err: unknown) {
    logger.error('Admin no disponible para public services', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(503).json({ success: false, error: 'No se pudo cargar' })
  }

  try {
    const site = await resolvePublishedSiteBySlug(supabase, slug)
    if (!site) {
      return res.status(404).json({ success: false, error: 'Página no encontrada o sin publicar' })
    }

    const [{ data: services, error: svcError }, { count: staffCount, error: staffError }] =
      await Promise.all([
        supabase
          .from('bookable_services')
          .select('id, name, price_cents, duration_min, buffer_min, sort_order')
          .eq('site_id', site.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('staff_members')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', site.id)
          .eq('is_active', true),
      ])

    if (svcError) throw new Error(svcError.message)
    if (staffError) throw new Error(staffError.message)

    const ready = (services?.length ?? 0) > 0 && (staffCount ?? 0) > 0
    return res.status(200).json({
      success: true,
      ready,
      services: services ?? [],
      staff_count: staffCount ?? 0,
    })
  } catch (err: unknown) {
    logger.error('Error listando servicios públicos', {
      slug,
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(500).json({ success: false, error: 'No se pudo cargar' })
  }
}

export default withRateLimit(PUBLIC_LEAD_LIMIT, handler)
