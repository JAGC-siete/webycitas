import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { handleRequest, type ProxyEnv } from '../workers/custom-domain-proxy/index'

const env: ProxyEnv = {
  ORIGIN: 'https://webycitas.example',
  DOMAIN: 'tienda.com',
  SLUG: 'mi-tienda',
  PROXY_SECRET: 's'.repeat(40),
}

function recordingFetch(response: () => Response = () => new Response('ok')) {
  const calls: { url: string; init: RequestInit }[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return response()
  }) as unknown as typeof fetch
  return { calls, impl }
}

function visit(path: string, init: RequestInit & { host?: string } = {}) {
  const { host = 'tienda.com', ...rest } = init
  return new Request(`https://${host}${path}`, rest)
}

describe('Worker de dominio propio', () => {
  it('pide la página del cliente al origen cuando entran a la raíz', async () => {
    const { calls, impl } = recordingFetch()
    const res = await handleRequest(
      visit('/?utm=ig', { headers: { 'cf-connecting-ip': '198.51.100.7', cookie: 'a=b' } }),
      env,
      impl
    )
    assert.equal(res.status, 200)
    assert.equal(calls[0].url, 'https://webycitas.example/p/mi-tienda?utm=ig')
    const headers = new Headers(calls[0].init.headers)
    assert.equal(headers.get('x-webycitas-client-ip'), '198.51.100.7')
    assert.equal(headers.get('x-webycitas-proxy-secret'), env.PROXY_SECRET)
    assert.equal(headers.get('cookie'), null)
    assert.equal(calls[0].init.redirect, 'manual')
  })

  it('no deja que el visitante mande su propia IP "confiable"', async () => {
    const { calls, impl } = recordingFetch()
    await handleRequest(
      visit('/', { headers: { 'x-webycitas-client-ip': '1.1.1.1', 'x-webycitas-proxy-secret': 'adivino' } }),
      env,
      impl
    )
    const headers = new Headers(calls[0].init.headers)
    assert.equal(headers.get('x-webycitas-client-ip'), null)
    assert.equal(headers.get('x-webycitas-proxy-secret'), null)
  })

  it('reenvía el formulario con su cuerpo', async () => {
    const { calls, impl } = recordingFetch(() => new Response('{"success":true}', { status: 201 }))
    const res = await handleRequest(
      visit('/api/inquiries', { method: 'POST', body: '{"fullName":"Ana"}', headers: { 'content-type': 'application/json' } }),
      env,
      impl
    )
    assert.equal(res.status, 201)
    assert.equal(calls[0].url, 'https://webycitas.example/api/inquiries')
    assert.equal(new TextDecoder().decode(calls[0].init.body as ArrayBuffer), '{"fullName":"Ana"}')
  })

  it('responde 404 a paneles y otras páginas sin tocar el origen', async () => {
    const { calls, impl } = recordingFetch()
    for (const path of ['/app', '/admin', '/p/otra', '/api/leads']) {
      assert.equal((await handleRequest(visit(path), env, impl)).status, 404, path)
    }
    assert.equal(calls.length, 0)
  })

  it('www y /p/<slug> van a la raíz del dominio', async () => {
    const { impl } = recordingFetch()
    const www = await handleRequest(visit('/?a=1', { host: 'www.tienda.com' }), env, impl)
    assert.equal(www.status, 301)
    assert.equal(www.headers.get('location'), 'https://tienda.com/?a=1')
    const old = await handleRequest(visit('/p/mi-tienda'), env, impl)
    assert.equal(old.headers.get('location'), 'https://tienda.com/')
  })

  it('sirve robots y sitemap del dominio', async () => {
    const { impl } = recordingFetch()
    const robots = await handleRequest(visit('/robots.txt'), env, impl)
    assert.match(await robots.text(), /Sitemap: https:\/\/tienda\.com\/sitemap\.xml/)
  })

  it('no filtra cookies del origen y corrige redirecciones hacia el origen', async () => {
    const { impl } = recordingFetch(
      () =>
        new Response(null, {
          status: 308,
          headers: { location: 'https://webycitas.example/p/mi-tienda', 'set-cookie': 'x=1' },
        })
    )
    const res = await handleRequest(visit('/'), env, impl)
    assert.equal(res.headers.get('location'), 'https://tienda.com/')
    assert.equal(res.headers.get('set-cookie'), null)
  })
})
