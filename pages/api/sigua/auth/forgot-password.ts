import type { NextApiRequest, NextApiResponse } from 'next'
import { normalizeEmail } from '../../../../lib/auth/credentials'
import { clientIp } from '../../../../lib/auth/request'
import { AUTH_UPDATE_PASSWORD_PATH, APP_LOGIN_PATH } from '../../../../lib/mercado/paths'
import { logger } from '../../../../lib/logger'
import { AUTH_FORGOT_LIMIT, consumeRateLimit } from '../../../../lib/rate-limit'
import { createSuiteServerClient } from '../../../../lib/suite/supabase-server'

function siteOrigin(req: NextApiRequest): string {
  const configured = (process.env.NEXT_PUBLIC_MERCADO_SITE_URL || '').replace(/\/$/, '')
  if (configured) return configured
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
  const host = req.headers.host || 'localhost:3000'
  return `${proto}://${host}`
}

/** Directory flavour of forgot-password: Supabase's own reset mail, landing back on this host. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const email = normalizeEmail(req.body?.email)
  const ip = clientIp(req)
  if (
    !(await consumeRateLimit(`forgot:ip:${ip}`, AUTH_FORGOT_LIMIT)) ||
    !(await consumeRateLimit(`forgot:email:${email}`, AUTH_FORGOT_LIMIT))
  ) {
    return res.status(429).json({ error: 'Demasiados envíos. Intenta en unos minutos.' })
  }

  // Respuesta uniforme para no filtrar existencia de cuentas.
  const okBody = {
    ok: true,
    message: 'Si el correo existe, enviamos instrucciones para restablecer la contraseña.',
  }

  if (!email.includes('@')) {
    return res.status(200).json(okBody)
  }

  try {
    const supabase = createSuiteServerClient(req, res)
    const redirectTo = `${siteOrigin(req)}${AUTH_UPDATE_PASSWORD_PATH}?next=${encodeURIComponent(APP_LOGIN_PATH)}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      logger.warn('forgot-password', { error: error.message })
    }
    return res.status(200).json(okBody)
  } catch (error: unknown) {
    logger.error('forgot-password', {
      error: error instanceof Error ? error.message : 'Unknown',
    })
    return res.status(200).json(okBody)
  }
}
