/**
 * Helpers para tokens/errores de Supabase en el hash (#access_token=...).
 */

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
