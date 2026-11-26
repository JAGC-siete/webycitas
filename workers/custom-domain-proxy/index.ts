/**
 * Cloudflare Worker that serves one client's Webycitas site on the client's own domain
 * (e.g. villesessence.com). It proxies to the Webycitas origin on Railway, so the domain
 * needs no custom-domain slot there. Same path rules as the Next middleware.
 *
 * Bundle and deploy: see workers/custom-domain-proxy/README.md.
 */

import {
  PROXY_CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  routeOnCustomDomain,
} from '../../lib/custom-domain-routing'

export interface ProxyEnv {
  /** Webycitas origin, e.g. https://webycitas.humanosisu.net */
  ORIGIN: string
  /** Bare domain, e.g. villesessence.com */
  DOMAIN: string
  /** Published site slug, e.g. ville-s-essence-ddbc */
  SLUG: string
  /** Same value as TRUSTED_PROXY_SECRET on Railway. */
  PROXY_SECRET: string
}

// Hop-by-hop and identity headers that must not reach the origin as-is.
const DROP_REQUEST_HEADERS = [
  'host',
  'cookie',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  PROXY_SECRET_HEADER,
  PROXY_CLIENT_IP_HEADER,
]

function text(body: string, status: number, contentType = 'text/plain; charset=utf-8'): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

export async function handleRequest(
  request: Request,
  env: ProxyEnv,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const url = new URL(request.url)
  const domain = env.DOMAIN.toLowerCase()
  const route = routeOnCustomDomain({
    hostname: url.hostname.toLowerCase(),
    domain,
    slug: env.SLUG,
    pathname: url.pathname,
  })

  switch (route.type) {
    case 'redirect':
      return Response.redirect(`${route.url}${url.search}`, 301)
    case 'robots':
      return text(route.body, 200)
    case 'sitemap':
      return text(route.body, 200, 'application/xml; charset=utf-8')
    case 'not-found':
      return text('Página no encontrada', 404)
  }

  const origin = new URL(env.ORIGIN)
  const upstreamPath = route.type === 'rewrite' ? route.pathname : url.pathname
  const target = new URL(`${upstreamPath}${url.search}`, origin)

  const headers = new Headers(request.headers)
  for (const name of DROP_REQUEST_HEADERS) headers.delete(name)
  const visitorIp = request.headers.get('cf-connecting-ip')
  if (visitorIp && env.PROXY_SECRET) {
    headers.set(PROXY_SECRET_HEADER, env.PROXY_SECRET)
    headers.set(PROXY_CLIENT_IP_HEADER, visitorIp)
  }
  headers.set('x-forwarded-host', domain)

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const upstream = await fetchImpl(target.toString(), {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  })

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('set-cookie')
  const location = responseHeaders.get('location')
  if (location) {
    const next = new URL(location, origin)
    if (next.host === origin.host) {
      const path = next.pathname === `/p/${env.SLUG}` ? '/' : next.pathname
      responseHeaders.set('location', `https://${domain}${path}${next.search}`)
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export default {
  fetch(request: Request, env: ProxyEnv): Promise<Response> {
    return handleRequest(request, env)
  },
}
