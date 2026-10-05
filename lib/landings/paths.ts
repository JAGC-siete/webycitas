import { siteAbsoluteUrl } from '../site'

export const SITE_PUBLIC_PREFIX = '/p'
export const MAGNET_PATH = '/'
export const LEADS_API_PATH = '/api/leads'
export const INQUIRIES_API_PATH = '/api/inquiries'
/** Alias for the published-page form. */
export const LANDING_LEAD_API_PATH = INQUIRIES_API_PATH

export const PRIVACY_PUBLIC_PATH = '/privacidad'
export const TERMS_PUBLIC_PATH = '/terminos'

/** Panel super_admin del constructor de landings. */
export const LANDINGS_ADMIN_PATH = '/app/landings'
export const LANDINGS_ADMIN_API_PREFIX = '/api/admin/ops/landings'

export function landingPublicPath(slug: string): string {
  return `${SITE_PUBLIC_PREFIX}/${slug}`
}

export function landingPublicUrl(slug: string): string {
  return siteAbsoluteUrl(landingPublicPath(slug))
}

export function landingAdminEditPath(id: string): string {
  return `${LANDINGS_ADMIN_PATH}/${id}/edit`
}

/** Stub MVP: consultas ops globales (sin página por-landing). */
export function landingAdminLeadsPath(_id: string): string {
  return '/admin/inquiries'
}

export function landingAdminApiPath(id: string): string {
  return `${LANDINGS_ADMIN_API_PREFIX}/${id}`
}

export function landingAdminPublishApiPath(id: string): string {
  return `${LANDINGS_ADMIN_API_PREFIX}/${id}/publish`
}

export function isPublicSiteRoute(pathname: string): boolean {
  return pathname === SITE_PUBLIC_PREFIX || pathname.startsWith(`${SITE_PUBLIC_PREFIX}/`)
}
