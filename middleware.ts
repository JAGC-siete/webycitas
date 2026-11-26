import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { routeForHost } from './lib/hosts'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
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
