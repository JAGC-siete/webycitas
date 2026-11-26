import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../logger'
import { AUTH_LOGIN_IP_EMAIL_LIMIT, AUTH_LOGIN_IP_LIMIT, consumeRateLimit } from '../rate-limit'
import { createAdminClient } from '../supabase/admin'
import { createSuiteServerClient } from '../suite/supabase-server'
import { INVALID_CREDENTIALS } from './api-auth'
import { resolveOwnerLead } from './claim-lead'
import { resolveOrClaimVendor } from './claim-vendor'
import { isUsableEmail, normalizeEmail, normalizePassword } from './credentials'
import { loadProfile } from './profile'
import { clientIp, clientUserAgent, hashSecret } from './request'
import { OWNER_ROLE, VENDOR_ROLE, canUseProduct, postLoginPathFor, type AppProduct } from './role-access'
import { createAppSession } from './session-manager'

/**
 * POST /api/auth/login for one product. Both hosts share the session model
 * (Supabase cookie + user_sessions token); only the allowed roles, the record each
 * role must own and the landing page change.
 */
export function createLoginHandler(product: AppProduct): NextApiHandler {
  return async function loginHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Método no permitido' })
    }

    const email = normalizeEmail(req.body?.email)
    const password = normalizePassword(req.body?.password)
    const redirect = typeof req.body?.redirect === 'string' ? req.body.redirect : null
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
      if (!profile || !canUseProduct(profile, product)) return deny()

      const admin = createAdminClient()
      let leadId: string | null = null
      let vendorId: string | null = null
      if (profile.role === OWNER_ROLE) {
        leadId = await resolveOwnerLead(admin, { userId: data.user.id, email })
        if (!leadId) return deny()
      } else if (profile.role === VENDOR_ROLE) {
        const vendor = await resolveOrClaimVendor(admin, { userId: data.user.id, email })
        if (!vendor) return deny()
        vendorId = vendor.id
      }

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
          vendor_id: vendorId,
          session_id: appSession.row.id,
          session_token: appSession.token,
        },
        session: data.session,
        userProfile: profile,
        redirectTo: postLoginPathFor(product, profile.role, redirect),
      })
    } catch (err: unknown) {
      logger.error('Login falló después de sign-in', {
        product,
        userId: data.user.id,
        error: err instanceof Error ? err.message : 'unknown',
      })
      await supabase.auth.signOut()
      return res.status(500).json({ error: 'No se pudo iniciar sesión' })
    }
  }
}
