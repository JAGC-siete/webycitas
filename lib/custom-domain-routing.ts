/**
 * What a client's own domain answers for each path. Pure and import-free so the
 * Next middleware and the Cloudflare Worker proxy (workers/custom-domain-proxy)
 * apply the exact same rules.
 */

/** Headers the Worker proxy adds so the app can trust the visitor's real IP (see lib/auth/request.ts). */
export const PROXY_SECRET_HEADER = 'x-webycitas-proxy-secret'
export const PROXY_CLIENT_IP_HEADER = 'x-webycitas-client-ip'

/** Paths a custom domain may serve besides its own page. Everything else is a 404 there. */
const PASSTHROUGH_PREFIXES = ['/_next/', '/api/inquiries', '/api/public/', '/landings/', '/fonts/']
const PASSTHROUGH_EXACT = new Set(['/favicon.ico'])

export type CustomDomainRoute =
  | { type: 'rewrite'; pathname: string }
  | { type: 'redirect'; url: string }
  | { type: 'robots'; body: string }
  | { type: 'sitemap'; body: string }
  | { type: 'not-found' }
  | { type: 'pass' }

export function customDomainRobots(domain: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://${domain}/sitemap.xml\n`
}

export function customDomainSitemap(domain: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <url><loc>https://${domain}/</loc></url>\n` +
    '</urlset>\n'
  )
}

/** `hostname` is the requested host (maybe www.); `domain` is the bare domain mapped to `slug`. */
export function routeOnCustomDomain(params: {
  hostname: string
  domain: string
  slug: string
  pathname: string
}): CustomDomainRoute {
  const { hostname, domain, slug, pathname } = params
  if (hostname !== domain) return { type: 'redirect', url: `https://${domain}${pathname}` }
  if (pathname === '/') return { type: 'rewrite', pathname: `/p/${slug}` }
  if (pathname === `/p/${slug}` || pathname === `/p/${slug}/`) return { type: 'redirect', url: `https://${domain}/` }
  if (pathname === '/robots.txt') return { type: 'robots', body: customDomainRobots(domain) }
  if (pathname === '/sitemap.xml') return { type: 'sitemap', body: customDomainSitemap(domain) }
  if (PASSTHROUGH_EXACT.has(pathname) || PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return { type: 'pass' }
  }
  return { type: 'not-found' }
}
