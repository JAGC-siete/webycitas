import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashSecret } from './request'

export const SESSION_TTL_SECONDS = 12 * 60 * 60
export const SESSION_IDLE_MINUTES = 90
export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000
export const SESSION_WARN_MS = 10 * 60 * 1000
export const LOCAL_USER_KEY = 'user'
export const LOCAL_SESSION_TOKEN_KEY = 'webycitas_session_token'

export interface AppSessionRow {
  id: string
  user_id: string
  last_activity: string
  expires_at: string
  idle_timeout_at: string
}

function sessionErrorCode(error: { message?: string; code?: string } | null): string {
  const raw = `${error?.message || ''} ${error?.code || ''}`.toLowerCase()
  if (raw.includes('session_expired') || raw.includes('session_revoked')) return 'session_expired'
  if (raw.includes('session_not_found')) return 'session_not_found'
  return 'session_error'
}

export function newSessionToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex')
  return { raw, hash: hashSecret(raw) }
}

export function tokenHash(raw: string): string {
  return hashSecret(raw.trim())
}

export async function createAppSession(
  admin: SupabaseClient,
  input: {
    userId: string
    ipHash: string
    uaHash: string
  }
): Promise<{ token: string; row: AppSessionRow }> {
  const token = newSessionToken()
  const { data, error } = await admin.rpc('create_user_session', {
    p_user_id: input.userId,
    p_session_token: token.hash,
    p_ip_hash: input.ipHash,
    p_ua_hash: input.uaHash,
    p_access_token_ttl_seconds: SESSION_TTL_SECONDS,
    p_idle_timeout_minutes: SESSION_IDLE_MINUTES,
  })
  if (error || !data) {
    throw new Error(error?.message || 'No se pudo abrir la sesión')
  }
  return { token: token.raw, row: data as AppSessionRow }
}

export async function touchAppSession(
  admin: SupabaseClient,
  input: { userId: string; sessionToken: string }
): Promise<{ ok: true; row: AppSessionRow } | { ok: false; status: 401 | 440; code: string }> {
  const { data, error } = await admin.rpc('update_session_activity', {
    p_session_token: tokenHash(input.sessionToken),
    p_user_id: input.userId,
  })
  if (error || !data) {
    const code = sessionErrorCode(error)
    return { ok: false, status: code === 'session_expired' ? 440 : 401, code }
  }
  return { ok: true, row: data as AppSessionRow }
}

export async function revokeAppSession(
  admin: SupabaseClient,
  input: { userId: string; sessionToken?: string | null }
): Promise<void> {
  let query = admin
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .is('revoked_at', null)
  if (input.sessionToken) {
    query = query.eq('session_token', tokenHash(input.sessionToken))
  }
  await query
}

export function idleRemainingMs(row: Pick<AppSessionRow, 'idle_timeout_at'>): number {
  return new Date(row.idle_timeout_at).getTime() - Date.now()
}
