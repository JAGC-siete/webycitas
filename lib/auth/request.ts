import { createHash } from 'crypto'
import type { IncomingHttpHeaders } from 'http'
import type { NextApiRequest } from 'next'

/**
 * IP del cliente detrás del proxy de Railway (un solo salto).
 * Usa la ÚLTIMA entrada de X-Forwarded-For: la agrega el proxy. Las anteriores
 * las manda el cliente y se pueden inventar para esquivar el rate limit.
 */
export function clientIp(req: { headers: IncomingHttpHeaders; socket?: { remoteAddress?: string } }): string {
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
