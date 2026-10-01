import type { NextApiRequest, NextApiResponse } from 'next'
import { opsAdminClearCookie } from '../../../lib/ops/admin-auth'
import { revokeAppSession } from '../../../lib/auth/session-manager'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createSuiteServerClient } from '../../../lib/suite/supabase-server'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const supabase = createSuiteServerClient(req, res)
  const { data } = await supabase.auth.getUser()
  const sessionToken = typeof req.body?.session_token === 'string' ? req.body.session_token : null

  if (data.user) {
    try {
      await revokeAppSession(createAdminClient(), { userId: data.user.id, sessionToken })
    } catch (err: unknown) {
      logger.warn('No se pudo revocar user_sessions', {
        userId: data.user.id,
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  await supabase.auth.signOut()
  opsAdminClearCookie(res)
  return res.status(200).json({ ok: true })
}
