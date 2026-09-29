import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../lib/logger'
import { maskEmail, normalizeSoftPhone } from '../../lib/privacy'
import { getResendFrom } from '../../lib/resend-from'
import { createAdminClient } from '../../lib/supabase/admin'
import { SITE_INQUIRIES_TABLE, SITES_TABLE } from '../../lib/landings/db'
import { buildLandingLeadNotification } from '../../lib/landings/lead-email'
import {
  LANDING_LEAD_SOURCE,
  landingLeadFieldErrors,
  looksLikeBot,
  parseLandingLead,
  type LandingLead,
} from '../../lib/landings/lead-schema'
import { PUBLIC_LEAD_LIMIT, withRateLimit } from '../../lib/rate-limit'

const MAX_BODY_BYTES = 8 * 1024
const BURST_WINDOW_MS = 60 * 1000
const BURST_MAX_LEADS = 10

interface ResolvedSite {
  id: string
  title: string
  slug: string
  lead_notify_email: string | null
}

type Supabase = ReturnType<typeof createAdminClient>

async function resolveSite(supabase: Supabase, lead: LandingLead): Promise<ResolvedSite | null> {
  let query = supabase
    .from(SITES_TABLE)
    .select('id, title, slug, lead_notify_email')
    .eq('status', 'published')

  query = lead.landingId ? query.eq('id', lead.landingId) : query.eq('slug', lead.slug as string)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ResolvedSite | null) ?? null
}

async function hasRecentBurst(supabase: Supabase, siteId: string): Promise<boolean> {
  const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString()
  const { count, error } = await supabase
    .from(SITE_INQUIRIES_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .gte('created_at', since)

  if (error) {
    logger.warn('No se pudo verificar ráfaga de inquiries', { siteId, error: error.message })
    return false
  }

  return (count ?? 0) >= BURST_MAX_LEADS
}

async function sendNotification(params: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY ausente' }

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const sent = await resend.emails.send({
    from: getResendFrom(),
    to: params.to,
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.html,
  })

  return sent.error ? { ok: false, error: sent.error.message } : { ok: true }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Método no permitido' })
  }

  const contentLength = Number(req.headers['content-length'] ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ success: false, error: 'Solicitud demasiado grande' })
  }

  const parsed = parseLandingLead(req.body)
  if (!parsed.success) {
    const fields = landingLeadFieldErrors(parsed.error)
    return res.status(400).json({
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      fields,
    })
  }

  const lead = parsed.data

  if (looksLikeBot(lead)) {
    logger.info('Inquiry descartado por honeypot', { slug: lead.slug ?? null })
    return res.status(200).json({ success: true, message: 'Lead registrado' })
  }

  let supabase: Supabase
  try {
    supabase = createAdminClient()
  } catch (err: unknown) {
    logger.error('Cliente admin no disponible para inquiries', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(503).json({ success: false, error: 'No se pudo procesar la solicitud' })
  }

  const receivedAt = new Date()

  let site: ResolvedSite | null
  try {
    site = await resolveSite(supabase, lead)
  } catch (err: unknown) {
    logger.error('Error resolviendo el site del inquiry', {
      slug: lead.slug ?? null,
      landingId: lead.landingId ?? null,
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(500).json({ success: false, error: 'No se pudo procesar la solicitud' })
  }

  if (!site) {
    return res.status(404).json({ success: false, error: 'Página no encontrada o sin publicar' })
  }

  if (await hasRecentBurst(supabase, site.id)) {
    logger.warn('Ráfaga de inquiries en un site', { siteId: site.id, slug: site.slug })
    return res.status(429).json({ success: false, error: 'Demasiados envíos. Intenta en unos minutos.' })
  }

  let inquiryId: string
  try {
    const { data, error } = await supabase
      .from(SITE_INQUIRIES_TABLE)
      .insert({
        site_id: site.id,
        full_name: lead.fullName,
        email: lead.email ?? null,
        phone: lead.phone ? normalizeSoftPhone(lead.phone) : null,
        message: lead.message ?? null,
        source: LANDING_LEAD_SOURCE,
        extra: lead.blockId ? { blockId: lead.blockId } : {},
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    inquiryId = (data as { id: string }).id
  } catch (err: unknown) {
    logger.error('No se pudo guardar inquiry', {
      siteId: site.id,
      email: lead.email ? maskEmail(lead.email) : null,
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(500).json({ success: false, error: 'No se pudo registrar el lead' })
  }

  const notifyEmail = site.lead_notify_email
  if (!notifyEmail) {
    logger.warn('Inquiry guardado sin destino de aviso', { siteId: site.id, inquiryId })
    return res.status(200).json({ success: true, message: 'Lead registrado' })
  }

  const mail = buildLandingLeadNotification({
    lead,
    landingTitle: site.title,
    slug: site.slug,
    receivedAt,
  })

  try {
    const sent = await sendNotification({
      to: notifyEmail,
      subject: mail.subject,
      html: mail.html,
      replyTo: mail.replyTo,
    })

    if (sent.ok) {
      await supabase
        .from(SITE_INQUIRIES_TABLE)
        .update({ notified_at: new Date().toISOString() })
        .eq('id', inquiryId)
    } else {
      logger.error('Aviso de inquiry no enviado', {
        siteId: site.id,
        inquiryId,
        to: maskEmail(notifyEmail),
        error: sent.error,
      })
    }
  } catch (err: unknown) {
    logger.error('Error enviando aviso de inquiry', {
      siteId: site.id,
      inquiryId,
      error: err instanceof Error ? err.message : 'Unknown',
    })
  }

  logger.info('Inquiry capturado', {
    siteId: site.id,
    inquiryId,
    slug: site.slug,
    email: lead.email ? maskEmail(lead.email) : null,
  })

  return res.status(200).json({ success: true, message: 'Lead registrado' })
}

export default withRateLimit(PUBLIC_LEAD_LIMIT, handler)
