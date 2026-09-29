import { siteAbsoluteUrl } from '../site'

export const SITE_PUBLIC_PREFIX = '/p'
export const MAGNET_PATH = '/'
export const LEADS_API_PATH = '/api/leads'
export const INQUIRIES_API_PATH = '/api/inquiries'
/** Alias for the published-page form. */
export const LANDING_LEAD_API_PATH = INQUIRIES_API_PATH

export const PRIVACY_PUBLIC_PATH = '/privacidad'
export const TERMS_PUBLIC_PATH = '/terminos'

export function landingPublicPath(slug: string): string {
  return `${SITE_PUBLIC_PREFIX}/${slug}`
}

export function landingPublicUrl(slug: string): string {
  return siteAbsoluteUrl(landingPublicPath(slug))
}

export function isPublicSiteRoute(pathname: string): boolean {
  return pathname === SITE_PUBLIC_PREFIX || pathname.startsWith(`${SITE_PUBLIC_PREFIX}/`)
}
