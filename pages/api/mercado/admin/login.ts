import type { NextApiRequest, NextApiResponse } from 'next'
import { clientIp } from '../../../../lib/auth/request'
import {
  mercadoAdminConfigured,
  mercadoAdminSetCookie,
  verifyMercadoAdminCredentials,
} from '../../../../lib/mercado/admin-auth'
import { AUTH_LOGIN_IP_EMAIL_LIMIT, AUTH_LOGIN_IP_LIMIT, consumeRateLimit } from '../../../../lib/rate-limit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  if (!mercadoAdminConfigured()) {
    return res.status(503).json({ error: 'Operador del directorio no configurado' })
  }

  const email = typeof req.body?.email === 'string' ? req.body.email : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const ip = clientIp(req)

  if (
    !(await consumeRateLimit(`mercado-login:ip:${ip}`, AUTH_LOGIN_IP_LIMIT)) ||
    !(await consumeRateLimit(`mercado-login:ip-email:${ip}:${email.trim().toLowerCase()}`, AUTH_LOGIN_IP_EMAIL_LIMIT))
  ) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta en unos minutos.' })
  }

  if (!verifyMercadoAdminCredentials(email, password)) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  mercadoAdminSetCookie(res, { email: email.trim().toLowerCase() })
  return res.status(200).json({ ok: true })
}
