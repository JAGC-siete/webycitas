/**
 * Login del operador de Webycitas (leads, sites, inquiries).
 * Cookie y secretos propios. No abre el directorio de Mercado ni la sesión de Planilla.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'
import { OPS_ADMIN_LOGIN_PATH, OPS_ADMIN_PREFIX, opsAdminLoginPath } from './paths'

export const OPS_ADMIN_COOKIE = 'webycitas_ops'
const TTL_MS = 12 * 60 * 60 * 1000

export type OpsOperator = { email: string }

function sessionSecret(): string | null {
  const raw = (process.env.WEBYCITAS_ADMIN_SESSION_SECRET || '').trim()
  return raw.length >= 16 ? raw : null
}

function configuredEmail(): string | null {
  const raw = (process.env.WEBYCITAS_ADMIN_EMAIL || '').trim().toLowerCase()
  return raw.includes('@') ? raw : null
}

function configuredPassword(): string | null {
  const raw = process.env.WEBYCITAS_ADMIN_PASSWORD || ''
  return raw.length >= 8 ? raw : null
}

export function opsAdminConfigured(): boolean {
  return Boolean(sessionSecret() && configuredEmail() && configuredPassword())
}

function hmac(value: string): Buffer {
  const secret = sessionSecret()
  if (!secret) throw new Error('admin_disabled')
  return createHmac('sha256', secret).update(value).digest()
}

function equalBytes(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

function equalText(a: string, b: string): boolean {
  return equalBytes(hmac(`t:${a}`), hmac(`t:${b}`))
}

export function verifyOpsAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = configuredEmail()
  const expectedPassword = configuredPassword()
  if (!expectedEmail || !expectedPassword || !sessionSecret()) return false
  return equalText(email.trim().toLowerCase(), expectedEmail) && equalText(password, expectedPassword)
}

function encodeSession(operator: OpsOperator, expiresAt: number): string {
  const payload = `${operator.email}|${expiresAt}`
  const sig = hmac(payload).toString('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function readOpsAdminSession(cookieValue?: string): OpsOperator | null {
  if (!cookieValue || !sessionSecret()) return null
  const [encoded, sig] = cookieValue.split('.')
  if (!encoded || !sig) return null
  let payload: string
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = hmac(payload).toString('base64url')
  if (!equalBytes(Buffer.from(sig), Buffer.from(expected))) return null
  const [email, expRaw] = payload.split('|')
  const expiresAt = Number(expRaw)
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null
  return { email }
}

export function opsOperatorFromReq(req: {
  cookies?: Partial<Record<string, string>>
}): OpsOperator | null {
  return readOpsAdminSession(req.cookies?.[OPS_ADMIN_COOKIE])
}

function cookieFlags(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TTL_MS / 1000)}${secure}`
}

export function opsAdminSetCookie(res: NextApiResponse, operator: OpsOperator) {
  const value = encodeSession(operator, Date.now() + TTL_MS)
  res.setHeader('Set-Cookie', `${OPS_ADMIN_COOKIE}=${value}; ${cookieFlags()}`)
}

export function opsAdminClearCookie(res: NextApiResponse) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${OPS_ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  )
}

export function requireOpsAdminApi(req: NextApiRequest, res: NextApiResponse): OpsOperator | null {
  const operator = opsOperatorFromReq(req)
  if (!operator) {
    res.status(401).json({ error: 'Inicia sesión para operar Webycitas' })
    return null
  }
  return operator
}

export async function requireOpsAdminPage(ctx: GetServerSidePropsContext): Promise<
  | { ok: true; operator: OpsOperator }
  | { ok: false; redirect: { destination: string; permanent: false } }
> {
  const operator = opsOperatorFromReq(ctx.req)
  if (!operator) {
    const next =
      ctx.resolvedUrl &&
      (ctx.resolvedUrl === OPS_ADMIN_PREFIX || ctx.resolvedUrl.startsWith(`${OPS_ADMIN_PREFIX}/`)) &&
      !ctx.resolvedUrl.startsWith(OPS_ADMIN_LOGIN_PATH)
        ? ctx.resolvedUrl
        : undefined
    return { ok: false, redirect: { destination: opsAdminLoginPath(next), permanent: false } }
  }
  return { ok: true, operator }
}
