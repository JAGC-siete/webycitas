/**
 * Helpers para tokens/errores de Supabase en el hash (#access_token=...)
 * y enlaces propios con token_hash (anti-prefetch).
 */

export type OwnerAccessLinkType = 'invite' | 'recovery'

export function parseAuthHash(hash: string): {
  error: string | null
  hasAccessToken: boolean
} {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return { error: null, hasAccessToken: false }
  const params = new URLSearchParams(raw)
  const error = params.get('error') || params.get('error_code')
  const hasAccessToken = Boolean(params.get('access_token')) || raw.includes('access_token')
  return { error, hasAccessToken }
}

/** Destino cuando Supabase deja tokens en /#... (Site URL = raíz). */
export function updatePasswordHashTarget(hash: string, next = '/app/login'): string {
  const normalized = hash.startsWith('#') ? hash : `#${hash}`
  return `/auth/update-password?next=${encodeURIComponent(next)}${normalized}`
}

export function ownerUpdatePasswordRedirectPath(): string {
  return '/auth/update-password?next=/app/login'
}

/**
 * Enlace a NUESTRA app con token_hash. No pasa por /auth/v1/verify al abrir el mail
 * (los scanners no consumen el OTP con un GET).
 */
export function buildOwnerAccessUrl(input: {
  origin: string
  tokenHash: string
  type: OwnerAccessLinkType
  next?: string
}): string {
  const origin = input.origin.replace(/\/$/, '')
  const next = input.next ?? '/app/login'
  const params = new URLSearchParams({
    token_hash: input.tokenHash,
    type: input.type,
    next,
  })
  return `${origin}/auth/update-password?${params.toString()}`
}

export function isLocalAuthOrigin(origin: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(origin)
}
