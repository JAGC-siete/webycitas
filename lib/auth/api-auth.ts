import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'
import type { User } from '@supabase/supabase-js'
import { logger } from '../logger'
import { createAdminClient } from '../supabase/admin'
import { createSuiteServerClient } from '../suite/supabase-server'
import { loadProfile } from './profile'
import { isSuperAdmin, loginPath, type UserProfileRow } from './role-access'
import { bearerToken, clientIp, clientUserAgent } from './request'

export interface AuthActor {
  user: User
  profile: UserProfileRow
  email: string
}

export const INVALID_CREDENTIALS = 'Credenciales inválidas'
export { loadProfile } from './profile'

async function userFromCookies(req: NextApiRequest | GetServerSidePropsContext['req'], res: NextApiResponse | GetServerSidePropsContext['res']): Promise<User | null> {
  const supabase = createSuiteServerClient(req, res)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

async function userFromBearer(req: NextApiRequest): Promise<User | null> {
  const token = bearerToken(req)
  if (!token) return null
  const admin = createAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function resolveAuthActor(
  req: NextApiRequest | GetServerSidePropsContext['req'],
  res: NextApiResponse | GetServerSidePropsContext['res']
): Promise<AuthActor | null> {
  const cookieUser = await userFromCookies(req, res)
  const user = cookieUser || ('headers' in req ? await userFromBearer(req as NextApiRequest) : null)
  if (!user) return null
  const profile = await loadProfile(user.id)
  if (!profile) return null
  return {
    user,
    profile,
    email: (user.email || '').toLowerCase(),
  }
}

export async function requireSuperAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  action: string
): Promise<AuthActor | null> {
  const actor = await resolveAuthActor(req, res)
  if (!actor) {
    res.status(401).json({ error: 'Inicia sesión para operar Webycitas' })
    return null
  }
  if (!isSuperAdmin(actor.profile)) {
    res.status(403).json({ error: INVALID_CREDENTIALS })
    return null
  }
  logger.info('ops_audit', {
    action,
    userId: actor.user.id,
    ip: clientIp(req),
    ua: clientUserAgent(req),
  })
  return actor
}

export async function requireSuperAdminPage(ctx: GetServerSidePropsContext): Promise<
  | { ok: true; actor: AuthActor }
  | { ok: false; redirect: { destination: string; permanent: false } }
> {
  const actor = await resolveAuthActor(ctx.req, ctx.res)
  const current =
    ctx.resolvedUrl && ctx.resolvedUrl.startsWith('/admin') && !ctx.resolvedUrl.startsWith('/admin/login')
      ? ctx.resolvedUrl.split('?')[0]
      : '/admin'
  if (!actor) {
    return { ok: false, redirect: { destination: loginPath(current), permanent: false } }
  }
  if (!isSuperAdmin(actor.profile)) {
    return { ok: false, redirect: { destination: '/app', permanent: false } }
  }
  return { ok: true, actor }
}
