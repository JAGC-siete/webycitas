import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../lib/logger'
import { createAdminClient } from '../../../lib/supabase/admin'
import { listOpenSlots } from '../../../lib/suite/availability'
import {
  publicAvailabilityQuerySchema,
  resolvePublishedSiteBySlug,
} from '../../../lib/suite/public-booking'
import { PUBLIC_LEAD_LIMIT, withRateLimit } from '../../../lib/rate-limit'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Método no permitido' })
  }

  const parsed = publicAvailabilityQuerySchema.safeParse({
    slug: req.query.slug,
    day: req.query.day,
    service_id: req.query.service_id,
  })
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
    })
  }

  const { slug, day, service_id } = parsed.data

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err: unknown) {
    logger.error('Admin no disponible para availability', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(503).json({ success: false, error: 'No se pudo cargar' })
  }

  try {
    const site = await resolvePublishedSiteBySlug(supabase, slug)
    if (!site) {
      return res.status(404).json({ success: false, error: 'Página no encontrada o sin publicar' })
    }

    const { data: service, error: svcError } = await supabase
      .from('bookable_services')
      .select('id, duration_min, buffer_min, is_active')
      .eq('id', service_id)
      .eq('site_id', site.id)
      .maybeSingle()
    if (svcError) throw new Error(svcError.message)
    if (!service || !service.is_active) {
      return res.status(404).json({ success: false, error: 'Servicio no disponible' })
    }

    const durationMin = (service.duration_min ?? 30) + (service.buffer_min ?? 0)
    const slots = await listOpenSlots(supabase, {
      siteId: site.id,
      day,
      durationMin,
    })

    return res.status(200).json({ success: true, slots })
  } catch (err: unknown) {
    logger.error('Error listando availability pública', {
      slug,
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(500).json({ success: false, error: 'No se pudo cargar horarios' })
  }
}

export default withRateLimit(PUBLIC_LEAD_LIMIT, handler)
