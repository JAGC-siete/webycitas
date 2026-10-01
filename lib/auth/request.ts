import { createHash } from 'crypto'
import type { IncomingHttpHeaders } from 'http'
import type { NextApiRequest } from 'next'

export function clientIp(req: { headers: IncomingHttpHeaders; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() || 'unknown'
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
