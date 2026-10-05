import type { NextApiRequest, NextApiResponse } from 'next'
import { emailParagraph, emailRows, wrapEmail } from '../../../lib/emails'
import { logger } from '../../../lib/logger'
import { maskEmail, normalizeSoftPhone } from '../../../lib/privacy'
import { getResendFrom } from '../../../lib/resend-from'
import { PUBLIC_LEAD_LIMIT, withRateLimit } from '../../../lib/rate-limit'
import { createAdminClient } from '../../../lib/supabase/admin'
import { listOpenSlots } from '../../../lib/suite/availability'
import { upsertCustomerByPhone } from '../../../lib/suite/customers'
import { addMinutesIso } from '../../../lib/suite/schemas'
import {
  looksLikePublicBookBot,
  parsePublicBook,
  publicBookFieldErrors,
  resolvePublishedSiteBySlug,
} from '../../../lib/suite/public-booking'
import { formatDateTimeForHonduras } from '../../../lib/timezone'

const MAX_BODY_BYTES = 8 * 1024

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

  const parsed = parsePublicBook(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      fields: publicBookFieldErrors(parsed.error),
    })
  }

  const body = parsed.data
  if (looksLikePublicBookBot(body)) {
    logger.info('Public book descartado por honeypot', { slug: body.slug })
    return res.status(200).json({ success: true, message: 'Solicitud registrada' })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err: unknown) {
    logger.error('Admin no disponible para public book', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(503).json({ success: false, error: 'No se pudo procesar la solicitud' })
  }

  try {
    const site = await resolvePublishedSiteBySlug(supabase, body.slug)
    if (!site) {
      return res.status(404).json({ success: false, error: 'Página no encontrada o sin publicar' })
    }

    const { data: service, error: svcError } = await supabase
      .from('bookable_services')
      .select('id, name, duration_min, buffer_min, is_active')
      .eq('id', body.service_id)
      .eq('site_id', site.id)
      .maybeSingle()
    if (svcError) throw new Error(svcError.message)
    if (!service || !service.is_active) {
      return res.status(404).json({ success: false, error: 'Servicio no disponible' })
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff_members')
      .select('id, is_active')
      .eq('id', body.staff_id)
      .eq('site_id', site.id)
      .maybeSingle()
    if (staffError) throw new Error(staffError.message)
    if (!staff || !staff.is_active) {
      return res.status(404).json({ success: false, error: 'Profesional no disponible' })
    }

    const durationMin = (service.duration_min ?? 30) + (service.buffer_min ?? 0)
    const day = new Date(body.starts_at).toLocaleDateString('en-CA', {
      timeZone: 'America/Tegucigalpa',
    })
    const openSlots = await listOpenSlots(supabase, {
      siteId: site.id,
      day,
      durationMin,
      staffId: body.staff_id,
    })
    const match = openSlots.find(
      (slot) => slot.starts_at === body.starts_at && slot.staff_id === body.staff_id
    )
    if (!match) {
      return res.status(409).json({
        success: false,
        error: 'Ese horario ya no está disponible. Elige otro.',
      })
    }

    const endsAt = addMinutesIso(body.starts_at, durationMin)
    const phone = body.customer_phone ? normalizeSoftPhone(body.customer_phone) : null
    const customerId = await upsertCustomerByPhone(supabase, site.id, {
      name: body.customer_name,
      phone,
      email: body.customer_email || null,
      notes: body.notes || null,
    })

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        site_id: site.id,
        customer_id: customerId,
        staff_id: body.staff_id,
        service_id: body.service_id,
        starts_at: body.starts_at,
        ends_at: endsAt,
        status: 'pending',
        source: 'web',
        notes: body.notes || null,
      })
      .select('id, starts_at, ends_at, status, source')
      .single()

    if (apptError) {
      if (apptError.message.includes('appointments_no_staff_overlap')) {
        return res.status(409).json({
          success: false,
          error: 'Ese horario ya está ocupado. Elige otro.',
        })
      }
      throw new Error(apptError.message)
    }

    if (site.lead_notify_email) {
      const receivedAt = new Date()
      const html = wrapEmail(
        'Nueva solicitud de cita',
        [
          emailParagraph(
            `Alguien pidió una cita en <strong>${site.title}</strong>. Está pendiente de confirmación en tu agenda.`
          ),
          emailRows([
            { label: 'Cliente', value: body.customer_name },
            { label: 'Correo', value: body.customer_email || '—' },
            { label: 'Teléfono / WhatsApp', value: phone || '—' },
            { label: 'Servicio', value: service.name },
            { label: 'Horario (HN)', value: formatDateTimeForHonduras(body.starts_at) },
            { label: 'Nota', value: body.notes || '—' },
            { label: 'Recibido (HN)', value: formatDateTimeForHonduras(receivedAt) },
          ]),
        ].join('')
      )

      try {
        const sent = await sendNotification({
          to: site.lead_notify_email,
          subject: `Nueva solicitud de cita — ${body.customer_name}`,
          html,
          replyTo: body.customer_email,
        })
        if (!sent.ok) {
          logger.error('Aviso de cita web no enviado', {
            siteId: site.id,
            appointmentId: appointment.id,
            to: maskEmail(site.lead_notify_email),
            error: sent.error,
          })
        }
      } catch (err: unknown) {
        logger.error('Error enviando aviso de cita web', {
          siteId: site.id,
          error: err instanceof Error ? err.message : 'Unknown',
        })
      }
    }

    logger.info('Cita web pendiente creada', {
      siteId: site.id,
      appointmentId: appointment.id,
      slug: site.slug,
    })

    return res.status(201).json({
      success: true,
      message: 'Solicitud registrada',
      appointment,
    })
  } catch (err: unknown) {
    logger.error('No se pudo crear cita pública', {
      slug: body.slug,
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return res.status(500).json({ success: false, error: 'No se pudo registrar la cita' })
  }
}

export default withRateLimit(PUBLIC_LEAD_LIMIT, handler)
