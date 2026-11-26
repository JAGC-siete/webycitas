/**
 * Client sites served on their own domain (e.g. villesessence.com → /p/<slug>).
 *
 * Configured with CUSTOM_DOMAIN_SITES="domain.com=slug,other.com=slug2" so the
 * middleware never queries Supabase. Edge-safe: no Node or Supabase imports.
 */

import { routeOnCustomDomain, type CustomDomainRoute } from './custom-domain-routing'
import { hostnameOf } from './hosts'

export type { CustomDomainRoute } from './custom-domain-routing'

function bareHost(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname
}

/** domain (without www) → slug. Invalid entries are ignored. */
export function customDomainSites(): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of (process.env.CUSTOM_DOMAIN_SITES || '').split(',')) {
    const [rawDomain, rawSlug] = entry.split('=').map((part) => part?.trim().toLowerCase() ?? '')
    if (!rawDomain || !rawSlug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(rawSlug)) continue
    map.set(bareHost(rawDomain), rawSlug)
  }
  return map
}

export function customDomainForSlug(slug: string): string | null {
  for (const [domain, mapped] of customDomainSites()) {
    if (mapped === slug) return domain
  }
  return null
}

/** Old /p/<slug> URLs 301 to the custom domain only once it is confirmed live. */
export function customDomainRedirectEnabled(): boolean {
  return process.env.CUSTOM_DOMAIN_REDIRECT === '1'
}

/**
 * Routing for a request. Returns null when the host is not a custom domain and
 * no old-URL redirect applies, so the caller falls through to the other gates.
 */
export function customDomainRoute(hostHeader: string, pathname: string): CustomDomainRoute | null {
  const hostname = hostnameOf(hostHeader)
  const sites = customDomainSites()
  const domain = bareHost(hostname)
  const slug = sites.get(domain)

  if (!slug) {
    const match = /^\/p\/([a-z0-9-]+)\/?$/.exec(pathname)
    const target = match ? customDomainForSlug(match[1]) : null
    if (target && customDomainRedirectEnabled()) return { type: 'redirect', url: `https://${target}/` }
    return null
  }

  return routeOnCustomDomain({ hostname, domain, slug, pathname })
}
