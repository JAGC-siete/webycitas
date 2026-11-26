/**
 * One login for both products. `site_user_profiles.role` says who the person is;
 * the product (picked by host, see lib/hosts.ts) says which roles may enter:
 * - webycitas: super_admin + owner (a Webycitas site owner, linked by leads.auth_user_id)
 * - directory: super_admin + vendor (a directory business owner, linked by mercado_vendors.auth_user_id)
 * An account has one role, so the same email cannot be both owner and vendor yet.
 */
export const APP_ROLES = ['super_admin', 'owner', 'vendor'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const SUPER_ADMIN_ROLE: AppRole = 'super_admin'
export const OWNER_ROLE: AppRole = 'owner'
export const VENDOR_ROLE: AppRole = 'vendor'

export const APP_PRODUCTS = ['webycitas', 'directory'] as const
export type AppProduct = (typeof APP_PRODUCTS)[number]

export const PRODUCT_ROLES: Record<AppProduct, readonly AppRole[]> = {
  webycitas: [SUPER_ADMIN_ROLE, OWNER_ROLE],
  directory: [SUPER_ADMIN_ROLE, VENDOR_ROLE],
}

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

export function isVendor(profile: { role?: unknown; is_active?: unknown } | null | undefined): boolean {
  return canLoginToApp(profile) && profile?.role === VENDOR_ROLE
}

/** Active profile whose role may enter this product. */
export function canUseProduct(
  profile: { role?: unknown; is_active?: unknown } | null | undefined,
  product: AppProduct
): boolean {
  return canLoginToApp(profile) && (PRODUCT_ROLES[product] as readonly unknown[]).includes(profile?.role)
}

function isDirectoryAdminPath(value: string): boolean {
  return value === '/app/mercado' || (value.startsWith('/app/mercado/') && !value.startsWith('/app/mercado/login'))
}

/** Same rules as postLoginPath, for the directory host. */
export function directoryPostLoginPath(role: AppRole, redirect?: string | null): string {
  const safe =
    typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('://')
      ? redirect
      : null
  if (role === SUPER_ADMIN_ROLE) return safe && isDirectoryAdminPath(safe) ? safe : '/app/mercado'
  return '/app'
}

export function postLoginPathFor(product: AppProduct, role: AppRole, redirect?: string | null): string {
  return product === 'directory' ? directoryPostLoginPath(role, redirect) : postLoginPath(role, redirect)
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

export function isOwnerAppRedirect(value: string): boolean {
  if (!isSafeAppRedirect(value)) return false
  if (!value.startsWith('/app')) return false
  if (value.startsWith('/app/login') || value.startsWith('/app/forgot-password')) return false
  if (value.startsWith('/app/mercado')) return false
  if (isLandingsAdminRedirect(value)) return false
  return true
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
  if (redirect && isOwnerAppRedirect(redirect)) return redirect
  return '/app'
}

export function loginPath(redirect?: string | null): string {
  if (redirect && isSafeAppRedirect(redirect)) {
    return `/app/login?redirect=${encodeURIComponent(redirect)}`
  }
  return '/app/login'
}
