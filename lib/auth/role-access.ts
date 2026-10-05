export const APP_ROLES = ['super_admin', 'owner'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const SUPER_ADMIN_ROLE: AppRole = 'super_admin'
export const OWNER_ROLE: AppRole = 'owner'

export interface UserProfileRow {
  id: string
  role: AppRole
  is_active: boolean
  permissions: Record<string, unknown>
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value)
}

export function canLoginToApp(profile: { role?: unknown; is_active?: unknown } | null | undefined): boolean {
  if (!profile || profile.is_active !== true) return false
  return isAppRole(profile.role)
}

export function isSuperAdmin(profile: { role?: unknown; is_active?: unknown } | null | undefined): boolean {
  return canLoginToApp(profile) && profile?.role === SUPER_ADMIN_ROLE
}

export function isOwner(profile: { role?: unknown; is_active?: unknown } | null | undefined): boolean {
  return canLoginToApp(profile) && profile?.role === OWNER_ROLE
}

export function isSafeAppRedirect(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//') || value.includes('://')) return false
  if (value.startsWith('/app/login') || value.startsWith('/app/forgot-password')) return false
  if (value.startsWith('/admin/login')) return false
  if (value.startsWith('/app/mercado')) return false
  return value === '/admin' || value.startsWith('/admin/') || value === '/app' || value.startsWith('/app/')
}

export function isAdminRedirect(value: string): boolean {
  return value === '/admin' || (value.startsWith('/admin/') && !value.startsWith('/admin/login'))
}

export function isLandingsAdminRedirect(value: string): boolean {
  return value === '/app/landings' || value.startsWith('/app/landings/')
}

export function postLoginPath(role: AppRole, redirect?: string | null): string {
  if (role === SUPER_ADMIN_ROLE) {
    if (
      redirect &&
      isSafeAppRedirect(redirect) &&
      (isAdminRedirect(redirect) || isLandingsAdminRedirect(redirect))
    ) {
      return redirect
    }
    return '/admin'
  }
  return '/app'
}

export function loginPath(redirect?: string | null): string {
  if (redirect && isSafeAppRedirect(redirect)) {
    return `/app/login?redirect=${encodeURIComponent(redirect)}`
  }
  return '/app/login'
}
