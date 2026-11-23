import type { GetServerSidePropsContext } from 'next'
import { resolveAuthActor } from '../auth/api-auth'
import {
  SUPER_ADMIN_ROLE,
  canUseProduct,
  type AppRole,
  type UserProfileRow,
} from '../auth/role-access'
import { APP_HOME_PATH, APP_LOGIN_PATH, appLoginPath, stripSiguaPrefix } from './paths'

/** Directory page guards on the shared login (lib/auth): same session, directory roles only. */

export type PageAuthOk = {
  ok: true
  userId: string
  email: string | null
  role: AppRole
  profile: UserProfileRow
}

export type PageAuthFail = {
  ok: false
  redirect: { destination: string; permanent: false }
}

/** Where to come back after login, as the browser sees it (no internal /sigua prefix). */
function loginReturnPath(ctx: GetServerSidePropsContext): string | undefined {
  const path = ctx.resolvedUrl ? stripSiguaPrefix(ctx.resolvedUrl) : undefined
  return path && path !== APP_LOGIN_PATH ? path : undefined
}

async function resolveDirectoryAuth(ctx: GetServerSidePropsContext): Promise<PageAuthOk | null> {
  const actor = await resolveAuthActor(ctx.req, ctx.res)
  if (!actor || !canUseProduct(actor.profile, 'directory')) return null
  return {
    ok: true,
    userId: actor.user.id,
    email: actor.email || null,
    role: actor.profile.role,
    profile: actor.profile,
  }
}

export async function requireSuperAdminPage(
  ctx: GetServerSidePropsContext
): Promise<PageAuthOk | PageAuthFail> {
  const auth = await resolveDirectoryAuth(ctx)
  if (!auth) {
    return { ok: false, redirect: { destination: appLoginPath(loginReturnPath(ctx)), permanent: false } }
  }
  if (auth.role !== SUPER_ADMIN_ROLE) {
    return { ok: false, redirect: { destination: APP_HOME_PATH, permanent: false } }
  }
  return auth
}

/** Directory business owners (and the operator, who can look at the portal too). */
export async function requireVendorPage(
  ctx: GetServerSidePropsContext
): Promise<PageAuthOk | PageAuthFail> {
  const auth = await resolveDirectoryAuth(ctx)
  if (!auth) {
    return { ok: false, redirect: { destination: appLoginPath(loginReturnPath(ctx)), permanent: false } }
  }
  return auth
}
