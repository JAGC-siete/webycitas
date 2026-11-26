/**
 * One app, two products, picked by host:
 * - Directory (Mercado Digital de Siguatepeque): sigua-online.com plus its legacy hosts. Its pages
 *   live under pages/sigua and its APIs under pages/api/sigua; middleware.ts rewrites public paths
 *   there, so visitors never see the internal prefix.
 * - Webycitas: every other host (webycitas.humanosisu.net, the Railway domain, localhost).
 * Cookies stay host-only (no Domain=), so the two products never share a session cookie.
 */

import {
  LEGACY_DIRECTORY_PREFIX,
  LEGACY_SAN_PABLO_PREFIX,
  MERCADO_ADMIN_HOME_PATH,
  MERCADO_INSCRIPTION_PATH,
  MERCADO_LEGACY_PREFIX,
  MERCADO_V2_PREFIX,
  SIGUA_PAGES_PREFIX,
  mercadoHomePath,
  mercadoVendorPath,
  stripSiguaPrefix,
} from './mercado/paths'

export const SIGUA_API_PREFIX = '/api/sigua'
/** robots.txt for the directory host; the Webycitas one stays at public/robots.txt. */
export const SIGUA_ROBOTS_PATH = '/sigua-robots.txt'

const SIGUA_DEFAULT_HOSTS = ['sigua-online.com', 'sigua.localhost']
const SIGUA_LEGACY_DEFAULT_HOSTS = ['mercado.humanosisu.net', 'www.sigua-online.com']

function hostSet(envName: string, defaults: readonly string[]): Set<string> {
  const extra = (process.env[envName] || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...defaults, ...extra])
}

export function hostnameOf(hostHeader: string): string {
  return hostHeader.split(':')[0].trim().toLowerCase()
}

/** Hosts that get a 301 to the directory's canonical host once it is configured. */
export function legacyHostnames(): Set<string> {
  return hostSet('MERCADO_LEGACY_HOSTS', SIGUA_LEGACY_DEFAULT_HOSTS)
}

/**
 * Host of NEXT_PUBLIC_MERCADO_SITE_URL. null locally or when unset, so a deploy that still
 * serves mercado.humanosisu.net never redirects to a domain without DNS.
 */
export function canonicalHostname(siteUrl = process.env.NEXT_PUBLIC_MERCADO_SITE_URL): string | null {
  if (!siteUrl) return null
  try {
    const host = new URL(siteUrl).hostname.toLowerCase()
    if (!host || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host)) return null
    return host
  } catch {
    return null
  }
}

export function isSiguaHost(hostHeader: string, siteUrl = process.env.NEXT_PUBLIC_MERCADO_SITE_URL): boolean {
  const host = hostnameOf(hostHeader)
  if (hostSet('MERCADO_HOSTS', SIGUA_DEFAULT_HOSTS).has(host)) return true
  if (legacyHostnames().has(host)) return true
  return host === canonicalHostname(siteUrl)
}

function isStaticFilePath(pathname: string): boolean {
  const last = pathname.split('/').pop() ?? ''
  return last.includes('.')
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function stripPrefix(pathname: string, prefix: string): string | null {
  if (pathname === prefix || pathname === `${prefix}/`) return ''
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length + 1).replace(/\/$/, '')
  return null
}

function directoryRestToPath(rest: string): string {
  if (!rest) return mercadoHomePath()
  if (rest === 'inscripcion') return MERCADO_INSCRIPTION_PATH
  return mercadoVendorPath(rest)
}

/** Current directory path for a path of the previous brand; null if it is not an old path. */
export function currentPathForLegacy(pathname: string): string | null {
  if (isStaticFilePath(pathname)) return null

  const sanPablo = stripPrefix(pathname, LEGACY_SAN_PABLO_PREFIX)
  if (sanPablo !== null) return MERCADO_V2_PREFIX

  const directory = stripPrefix(pathname, LEGACY_DIRECTORY_PREFIX)
  if (directory !== null) return directoryRestToPath(directory)

  const legacy = stripPrefix(pathname, MERCADO_LEGACY_PREFIX)
  if (legacy !== null) return directoryRestToPath(legacy)

  return null
}

export type HostRoute =
  | { kind: 'next' }
  | { kind: 'rewrite'; pathname: string }
  /** origin null = same host. */
  | { kind: 'redirect'; origin: string | null; pathname: string }
  | { kind: 'not_found' }

function siguaRoute(host: string, pathname: string, siteUrl: string | undefined): HostRoute {
  const canonical = canonicalHostname(siteUrl)
  // APIs and Next assets never move host: a POST answered with 301 comes back as a GET.
  const movesHost =
    canonical !== null &&
    host !== canonical &&
    legacyHostnames().has(host) &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/')
  const legacyPath = currentPathForLegacy(pathname)
  if (movesHost || legacyPath !== null) {
    return {
      kind: 'redirect',
      origin: movesHost ? `https://${canonical}` : null,
      pathname: legacyPath ?? pathname,
    }
  }

  // The internal prefix is never a public URL; send hand-typed ones to the real path.
  if (matchesPrefix(pathname, SIGUA_PAGES_PREFIX)) {
    return { kind: 'redirect', origin: null, pathname: stripSiguaPrefix(pathname) }
  }
  if (matchesPrefix(pathname, SIGUA_API_PREFIX)) return { kind: 'not_found' }

  if (pathname === '/api/health' || pathname.startsWith('/_next/')) return { kind: 'next' }
  if (pathname.startsWith('/api/')) {
    return { kind: 'rewrite', pathname: `${SIGUA_API_PREFIX}${pathname.slice('/api'.length)}` }
  }
  if (pathname === '/robots.txt') return { kind: 'rewrite', pathname: SIGUA_ROBOTS_PATH }
  if (isStaticFilePath(pathname)) return { kind: 'next' }
  return { kind: 'rewrite', pathname: pathname === '/' ? SIGUA_PAGES_PREFIX : `${SIGUA_PAGES_PREFIX}${pathname}` }
}

function webycitasRoute(pathname: string, siteUrl: string | undefined): HostRoute {
  if (matchesPrefix(pathname, SIGUA_PAGES_PREFIX) || matchesPrefix(pathname, SIGUA_API_PREFIX)) {
    return { kind: 'not_found' }
  }

  // Old copy of the directory that used to live on this host: send it to the directory.
  const legacyPath = currentPathForLegacy(pathname)
  const oldAdmin = matchesPrefix(pathname, MERCADO_ADMIN_HOME_PATH)
  if (legacyPath === null && !oldAdmin) return { kind: 'next' }

  const canonical = canonicalHostname(siteUrl)
  if (!canonical) return { kind: 'not_found' }
  return { kind: 'redirect', origin: `https://${canonical}`, pathname: legacyPath ?? pathname }
}

export function routeForHost(
  hostHeader: string,
  pathname: string,
  siteUrl = process.env.NEXT_PUBLIC_MERCADO_SITE_URL
): HostRoute {
  if (isSiguaHost(hostHeader, siteUrl)) return siguaRoute(hostnameOf(hostHeader), pathname, siteUrl)
  return webycitasRoute(pathname, siteUrl)
}
