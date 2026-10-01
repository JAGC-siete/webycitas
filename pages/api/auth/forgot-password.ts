import type { NextApiRequest, NextApiResponse } from 'next'
import { isUsableEmail, normalizeEmail } from '../../../lib/auth/credentials'
import { AUTH_FORGOT_LIMIT, consumeRateLimit } from '../../../lib/rate-limit'
import { clientIp } from '../../../lib/auth/request'
import { siteAbsoluteUrl } from '../../../lib/site'
import { createAdminClient } from '../../../lib/supabase/admin'
import { logger } from '../../../lib/logger'

const GENERIC_OK = { ok: true }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const email = normalizeEmail(req.body?.email)
  const ip = clientIp(req)
  if (!consumeRateLimit(`forgot:ip:${ip}`, AUTH_FORGOT_LIMIT) || !consumeRateLimit(`forgot:email:${email}`, AUTH_FORGOT_LIMIT)) {
    return res.status(429).json({ error: 'Demasiados envíos. Intenta en unos minutos.' })
  }

  if (!isUsableEmail(email)) return res.status(200).json(GENERIC_OK)

  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: siteAbsoluteUrl('/auth/update-password?next=/app/login'),
    })
    if (error) {
      logger.warn('forgot-password no envió correo', { error: error.message })
    }
  } catch (err: unknown) {
    logger.warn('forgot-password falló', { error: err instanceof Error ? err.message : 'unknown' })
  }

  return res.status(200).json(GENERIC_OK)
}
