import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveAuthActor } from '../../../lib/auth/api-auth'
import { idleRemainingMs, touchAppSession } from '../../../lib/auth/session-manager'
import { createAdminClient } from '../../../lib/supabase/admin'
import { loginPath } from '../../../lib/auth/role-access'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const actor = await resolveAuthActor(req, res)
  if (!actor) {
    return res.status(401).json({ error: 'Sesión expirada', redirect: loginPath() })
  }

  const sessionToken = typeof req.body?.session_token === 'string' ? req.body.session_token : ''
  if (!sessionToken) {
    return res.status(401).json({ error: 'Sesión expirada', redirect: loginPath() })
  }

  const touched = await touchAppSession(createAdminClient(), {
    userId: actor.user.id,
    sessionToken,
  })
  if (!touched.ok) {
    return res.status(touched.status).json({
      error: 'Sesión expirada',
      code: touched.code,
      redirect: loginPath(),
    })
  }

  return res.status(200).json({
    ok: true,
    idle_remaining_ms: idleRemainingMs(touched.row),
    expires_at: touched.row.expires_at,
    idle_timeout_at: touched.row.idle_timeout_at,
  })
}
