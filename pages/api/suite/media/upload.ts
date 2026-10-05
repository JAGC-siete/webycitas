/**
 * Upload de imágenes del site (landing + inventario) al bucket site-media.
 * Owners (sitio|inventario) o super_admin (con siteId). Escritura vía service_role.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'
import { requireSuperAdmin } from '../../../../lib/auth/api-auth'
import { clientIp } from '../../../../lib/auth/request'
import { logger } from '../../../../lib/logger'
import { consumeRateLimit, SUITE_MEDIA_UPLOAD_LIMIT } from '../../../../lib/rate-limit'
import { createAdminClient } from '../../../../lib/supabase/admin'
import {
  SITE_MEDIA_BUCKET,
  extForMediaMime,
  parseMediaUploadBody,
  siteMediaObjectPath,
} from '../../../../lib/suite/media'
import { resolveSuiteContext } from '../../../../lib/suite/tenant'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const parsed = parseMediaUploadBody(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error })
  }

  let siteId: string
  let rateSubject: string

  const suite = await resolveSuiteContext(req, res)
  if (suite) {
    if (!suite.tenant.site) {
      return res.status(400).json({ error: 'Sin sitio' })
    }
    if (!suite.tenant.modules.includes('sitio') && !suite.tenant.modules.includes('inventario')) {
      return res.status(403).json({
        error: 'Tu plan no incluye sitio ni inventario',
        code: 'MODULE_NOT_ENABLED',
      })
    }
    siteId = suite.tenant.site.id
    rateSubject = `lead:${suite.tenant.leadId}`
  } else {
    const actor = await requireSuperAdmin(req, res, 'suite.media.upload')
    if (!actor) return
    if (!parsed.siteIdHint) {
      return res.status(400).json({ error: 'siteId es obligatorio para operadores' })
    }
    siteId = parsed.siteIdHint
    rateSubject = `ops:${actor.user.id}`

    const admin = createAdminClient()
    const { data: site, error: siteError } = await admin
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .maybeSingle()
    if (siteError) {
      logger.error('site media upload site lookup', { siteId, error: siteError.message })
      return res.status(500).json({ error: 'No se pudo validar el sitio' })
    }
    if (!site) {
      return res.status(404).json({ error: 'Sitio no encontrado' })
    }
  }

  const ip = clientIp(req)
  const allowed =
    (await consumeRateLimit(`suite-media:site:${siteId}`, SUITE_MEDIA_UPLOAD_LIMIT)) &&
    (await consumeRateLimit(`suite-media:${rateSubject}`, SUITE_MEDIA_UPLOAD_LIMIT)) &&
    (await consumeRateLimit(`suite-media:ip:${ip}`, SUITE_MEDIA_UPLOAD_LIMIT))
  if (!allowed) {
    return res.status(429).json({ error: 'Demasiadas subidas. Intenta en unos minutos.' })
  }

  const path = siteMediaObjectPath(siteId, parsed.kind, extForMediaMime(parsed.mime), randomUUID())

  try {
    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from(SITE_MEDIA_BUCKET)
      .upload(path, parsed.buffer, { contentType: parsed.mime, upsert: false })

    if (uploadError) {
      logger.error('site media upload', { siteId, kind: parsed.kind, error: uploadError.message })
      return res.status(500).json({ error: 'No se pudo subir la imagen' })
    }

    const { data: publicData } = admin.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(path)
    return res.status(201).json({
      path,
      url: publicData.publicUrl,
    })
  } catch (err: unknown) {
    logger.error('site media upload failed', {
      siteId,
      error: err instanceof Error ? err.message : 'unknown',
    })
    return res.status(500).json({ error: 'No se pudo subir la imagen' })
  }
}
