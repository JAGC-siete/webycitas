import { LOCAL_SESSION_TOKEN_KEY, LOCAL_USER_KEY, SESSION_HEADER } from './session-manager'
import type { AppRole } from './role-access'

export interface StoredUser {
  id: string
  email: string
  role: AppRole
  lead_id: string | null
  session_id?: string
  session_token?: string
}

export function persistLogin(user: StoredUser): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
  if (user.session_token) {
    window.localStorage.setItem(LOCAL_SESSION_TOKEN_KEY, user.session_token)
  }
}

export function readStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LOCAL_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

export function readSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(LOCAL_SESSION_TOKEN_KEY) || readStoredUser()?.session_token || null
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LOCAL_USER_KEY)
  window.localStorage.removeItem(LOCAL_SESSION_TOKEN_KEY)
}

export async function signOutClient(): Promise<void> {
  const sessionToken = readSessionToken()
  clearStoredAuth()
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken }),
    })
  } catch {
    // el redirect de login cubre el corte
  }
}

/** Fetch autenticado para APIs `/api/admin/ops/*` (JWT cookie + sesión app). */
export async function opsFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const sessionToken = readSessionToken()
  if (sessionToken) headers.set(SESSION_HEADER, sessionToken)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })
}

/** Fetch autenticado para APIs `/api/suite/*`. */
export async function suiteFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return opsFetch(input, init)
}
