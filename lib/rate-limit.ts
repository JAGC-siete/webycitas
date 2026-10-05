import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { clientIp } from './auth/request'
import { logger } from './logger'
import { createAdminClient } from './supabase/admin'

const hits = new Map<string, { count: number; resetAt: number }>()

function consumeRateLimitLocal(key: string, config: { windowMs: number; max: number }): boolean {
  const now = Date.now()
  const current = hits.get(key)
  if (!current || current.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + config.windowMs })
    return true
  }
  current.count += 1
  return current.count <= config.max
}

/** Solo para tests unitarios sin DB. Preferí `consumeRateLimit` en runtime. */
export function consumeRateLimitSync(key: string, config: { windowMs: number; max: number }): boolean {
  return consumeRateLimitLocal(key, config)
}

export async function consumeRateLimit(
  key: string,
  config: { windowMs: number; max: number }
): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_key: key,
      p_window_ms: config.windowMs,
      p_max: config.max,
    })
    if (error) throw error
    return data === true
  } catch (err: unknown) {
    logger.warn('rate_limit RPC falló; fallback in-memory', {
      key,
      error: err instanceof Error ? err.message : 'unknown',
    })
    return consumeRateLimitLocal(key, config)
  }
}

export function withRateLimit(
  config: { windowMs: number; max: number },
  handler: NextApiHandler
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const ip = clientIp(req)
    if (!(await consumeRateLimit(`ip:${ip}`, config))) {
      return res.status(429).json({ success: false, error: 'Demasiados envíos. Intenta en unos minutos.' })
    }
    return handler(req, res)
  }
}

export const PUBLIC_LEAD_LIMIT = { windowMs: 10 * 60 * 1000, max: 6 }
export const AUTH_LOGIN_IP_LIMIT = { windowMs: 15 * 60 * 1000, max: 40 }
export const AUTH_LOGIN_IP_EMAIL_LIMIT = { windowMs: 15 * 60 * 1000, max: 8 }
export const AUTH_FORGOT_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 }
/** Uploads autenticados de site-media (landing + inventario). */
export const SUITE_MEDIA_UPLOAD_LIMIT = { windowMs: 15 * 60 * 1000, max: 30 }
