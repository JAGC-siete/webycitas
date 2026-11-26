import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { customDomainRoute } from './lib/custom-domains'
import { rewritePathForHost } from './lib/hosts'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const custom = customDomainRoute(host, req.nextUrl.pathname)
  if (custom) {
    switch (custom.type) {
      case 'pass':
        return NextResponse.next()
      case 'redirect':
        return NextResponse.redirect(custom.url, 301)
      case 'rewrite': {
        const url = req.nextUrl.clone()
        url.pathname = custom.pathname
        return NextResponse.rewrite(url)
      }
      case 'robots':
        return new NextResponse(custom.body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      case 'sitemap':
        return new NextResponse(custom.body, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
      case 'not-found':
        return new NextResponse('Página no encontrada', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
    }
  }

  const nextPath = rewritePathForHost(host, req.nextUrl.pathname)
  if (!nextPath) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = nextPath
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
