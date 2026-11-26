import { createHash, timingSafeEqual } from 'crypto'
import type { IncomingHttpHeaders } from 'http'
import type { NextApiRequest } from 'next'
import { PROXY_CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from '../custom-domain-routing'

/**
 * IP del cliente detrás del proxy de Railway (un solo salto).
 * Usa la ÚLTIMA entrada de X-Forwarded-For: la agrega el proxy. Las anteriores
 * las manda el cliente y se pueden inventar para esquivar el rate limit.
 */
function headerValue(headers: IncomingHttpHeaders, name: string): string {
  const raw = headers[name]
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ''
}

/**
 * Client IP relayed by our own Cloudflare Worker (client domains). Behind it every visitor
 * would share the Worker's IP and its rate limit, so the Worker sends the real one. Trusted
 * only with the shared secret (TRUSTED_PROXY_SECRET, 32+ chars).
 */
function trustedProxyClientIp(headers: IncomingHttpHeaders): string | null {
  const expected = process.env.TRUSTED_PROXY_SECRET || ''
  if (expected.length < 32) return null
  const given = headerValue(headers, PROXY_SECRET_HEADER)
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const ip = headerValue(headers, PROXY_CLIENT_IP_HEADER)
  return /^[0-9a-f:.]{2,45}$/i.test(ip) ? ip : null
}

export function clientIp(req: { headers: IncomingHttpHeaders; socket?: { remoteAddress?: string } }): string {
  const proxied = trustedProxyClientIp(req.headers)
  if (proxied) return proxied
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded.join(',') : forwarded
  if (typeof raw === 'string' && raw.length > 0) {
    const hops = raw.split(',').map((hop) => hop.trim()).filter(Boolean)
    const last = hops[hops.length - 1]
    if (last) return last
  }
  return req.socket?.remoteAddress || 'unknown'
}

export function clientUserAgent(req: { headers: IncomingHttpHeaders }): string {
  const raw = req.headers['user-agent']
  return typeof raw === 'string' ? raw : ''
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function bearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string') return null
  const [scheme, token] = header.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null
  return token.trim() || null
}
