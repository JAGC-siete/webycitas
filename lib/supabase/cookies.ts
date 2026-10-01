import type { CookieOptions } from '@supabase/ssr'

export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24

export function authCookieOptions(): CookieOptions {
  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: AUTH_COOKIE_MAX_AGE,
  }
}
