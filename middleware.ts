import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { customDomainRoute, type CustomDomainRoute } from './lib/custom-domains'
import { routeForHost } from './lib/hosts'

function customDomainResponse(req: NextRequest, route: CustomDomainRoute): NextResponse {
  switch (route.type) {
    case 'pass':
      return NextResponse.next()
    case 'redirect':
      return NextResponse.redirect(route.url, 301)
    case 'rewrite': {
      const url = req.nextUrl.clone()
      url.pathname = route.pathname
      return NextResponse.rewrite(url)
    }
    case 'robots':
      return new NextResponse(route.body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    case 'sitemap':
      return new NextResponse(route.body, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
    case 'not-found':
      return new NextResponse('Página no encontrada', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
  }
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  // Client domains first: on them nothing from Webycitas or the directory may answer.
  const custom = customDomainRoute(host, req.nextUrl.pathname)
  if (custom) return customDomainResponse(req, custom)

  const route = routeForHost(host, req.nextUrl.pathname)

  if (route.kind === 'next') return NextResponse.next()

  if (route.kind === 'not_found') {
    return NextResponse.rewrite(new URL('/404', req.url), { status: 404 })
  }

  if (route.kind === 'rewrite') {
    const url = req.nextUrl.clone()
    url.pathname = route.pathname
    return NextResponse.rewrite(url)
  }

  // Behind Railway's proxy nextUrl may carry the internal origin; build it from the Host header.
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.nextUrl.protocol.replace(':', '')
  const origin = route.origin ?? `${proto}://${host}`
  return NextResponse.redirect(new URL(`${route.pathname}${req.nextUrl.search}`, origin), 301)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
