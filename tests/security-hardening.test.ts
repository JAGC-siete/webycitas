import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clientIp } from '../lib/auth/request'
import { ensureOwnerProfile } from '../lib/auth/invite-owner'
import { serializeJsonLd } from '../lib/seo/schema'
import { landingLocalBusinessJsonLd } from '../lib/landings/jsonld'
import mercadoLogin from '../pages/api/mercado/admin/login'

describe('JSON-LD no rompe el <script>', () => {
  it('escapa </script> en texto del owner', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' })
    assert.ok(!out.includes('<'))
    assert.deepEqual(JSON.parse(out), { name: '</script><script>alert(1)</script>' })
  })

  it('el business.name de /p/[slug] sale escapado', () => {
    const jsonLd = landingLocalBusinessJsonLd({
      slug: 'x',
      templateType: 'barberia',
      content: {
        meta: { noindex: false, seoDescription: 'd' },
        business: { name: '</script><img src=x onerror=alert(1)>' },
        blocks: [],
      },
    } as never)
    assert.ok(jsonLd)
    assert.ok(!serializeJsonLd(jsonLd).includes('</script>'))
  })
})

describe('clientIp detrás de Railway', () => {
  it('ignora la IP inventada por el cliente al inicio de X-Forwarded-For', () => {
    assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' } }), '203.0.113.9')
  })

  it('un solo salto devuelve esa IP', () => {
    assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9' } }), '203.0.113.9')
  })

  it('sin header usa el socket', () => {
    assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '10.0.0.1' } }), '10.0.0.1')
  })
})

describe('ensureOwnerProfile', () => {
  it('no pisa role ni is_active de un perfil existente', async () => {
    let options: Record<string, unknown> | undefined
    const admin = {
      from: () => ({
        upsert: (_row: unknown, opts: Record<string, unknown>) => {
          options = opts
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as SupabaseClient
    await ensureOwnerProfile(admin, 'user-1')
    assert.equal(options?.ignoreDuplicates, true)
  })
})

describe('login del operador Mercado', () => {
  it('frena fuerza bruta con 429', async () => {
    process.env.MERCADO_ADMIN_EMAIL = 'op@example.com'
    process.env.MERCADO_ADMIN_PASSWORD = 'correct-horse'
    process.env.MERCADO_ADMIN_SESSION_SECRET = 'x'.repeat(32)

    const statuses: number[] = []
    for (let i = 0; i < 10; i += 1) {
      let status = 0
      const res = {
        setHeader: () => res,
        status: (code: number) => {
          status = code
          return res
        },
        json: () => res,
      } as unknown as NextApiResponse
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.77' },
        body: { email: 'op@example.com', password: `wrong-${i}` },
      } as unknown as NextApiRequest
      await mercadoLogin(req, res)
      statuses.push(status)
    }
    assert.equal(statuses[0], 401)
    assert.equal(statuses[statuses.length - 1], 429)
  })
})
