import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveOwnerLead } from '../../../lib/auth/claim-lead'
import { isUsableEmail, normalizeEmail, normalizePassword } from '../../../lib/auth/credentials'
import { INVALID_CREDENTIALS } from '../../../lib/auth/api-auth'
import { loadProfile } from '../../../lib/auth/profile'
import { clientIp, clientUserAgent, hashSecret } from '../../../lib/auth/request'
import { canLoginToApp, isOwner, isSuperAdmin } from '../../../lib/auth/role-access'
import { createAppSession } from '../../../lib/auth/session-manager'
import { logger } from '../../../lib/logger'
import { AUTH_LOGIN_IP_EMAIL_LIMIT, AUTH_LOGIN_IP_LIMIT, consumeRateLimit } from '../../../lib/rate-limit'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createSuiteServerClient } from '../../../lib/suite/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const email = normalizeEmail(req.body?.email)
  const password = normalizePassword(req.body?.password)
  const ip = clientIp(req)

  if (
    !(await consumeRateLimit(`login:ip:${ip}`, AUTH_LOGIN_IP_LIMIT)) ||
    !(await consumeRateLimit(`login:ip-email:${ip}:${email}`, AUTH_LOGIN_IP_EMAIL_LIMIT))
  ) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta en unos minutos.' })
  }

  if (!isUsableEmail(email) || password.length < 8) {
    return res.status(403).json({ error: INVALID_CREDENTIALS })
  }

  const supabase = createSuiteServerClient(req, res)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user || !data.session) {
    return res.status(403).json({ error: INVALID_CREDENTIALS })
  }

  const deny = async () => {
    await supabase.auth.signOut()
    return res.status(403).json({ error: INVALID_CREDENTIALS })
  }

  try {
    const profile = await loadProfile(data.user.id)
    if (!profile || !canLoginToApp(profile)) return deny()

    let leadId: string | null = null
    if (isOwner(profile)) {
      const admin = createAdminClient()
      leadId = await resolveOwnerLead(admin, { userId: data.user.id, email })
      if (!leadId) return deny()
    } else if (!isSuperAdmin(profile)) {
      return deny()
    }

    const admin = createAdminClient()
    const appSession = await createAppSession(admin, {
      userId: data.user.id,
      ipHash: hashSecret(ip),
      uaHash: hashSecret(clientUserAgent(req)),
    })

    return res.status(200).json({
      user: {
        id: data.user.id,
        email,
        role: profile.role,
        lead_id: leadId,
        session_id: appSession.row.id,
        session_token: appSession.token,
      },
      session: data.session,
      userProfile: profile,
    })
  } catch (err: unknown) {
    logger.error('Login Webycitas falló después de sign-in', {
      userId: data.user.id,
      error: err instanceof Error ? err.message : 'unknown',
    })
    await supabase.auth.signOut()
    return res.status(500).json({ error: 'No se pudo iniciar sesión' })
  }
}
