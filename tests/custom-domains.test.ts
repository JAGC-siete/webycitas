import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { customDomainForSlug, customDomainRoute, customDomainSites } from '../lib/custom-domains'
import { landingPublicHref, landingPublicUrl } from '../lib/landings/paths'

const ENV_KEYS = ['CUSTOM_DOMAIN_SITES', 'CUSTOM_DOMAIN_REDIRECT'] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  process.env.CUSTOM_DOMAIN_SITES = 'Tienda.com=mi-tienda, www.otra.hn=otra-tienda, malo=, x.com=Bad Slug!'
  delete process.env.CUSTOM_DOMAIN_REDIRECT
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('dominios propios', () => {
  it('lee el mapa dominio → sitio e ignora entradas inválidas', () => {
    assert.deepEqual([...customDomainSites()], [
      ['tienda.com', 'mi-tienda'],
      ['otra.hn', 'otra-tienda'],
    ])
    assert.equal(customDomainForSlug('mi-tienda'), 'tienda.com')
    assert.equal(customDomainForSlug('nadie'), null)
  })

  it('sirve la página del cliente en la raíz', () => {
    assert.deepEqual(customDomainRoute('tienda.com', '/'), { type: 'rewrite', pathname: '/p/mi-tienda' })
    assert.deepEqual(customDomainRoute('TIENDA.com:443', '/'), { type: 'rewrite', pathname: '/p/mi-tienda' })
  })

  it('manda www y la ruta /p/<slug> a la raíz del dominio', () => {
    assert.deepEqual(customDomainRoute('www.tienda.com', '/'), { type: 'redirect', url: 'https://tienda.com/' })
    assert.deepEqual(customDomainRoute('tienda.com', '/p/mi-tienda'), { type: 'redirect', url: 'https://tienda.com/' })
  })

  it('deja pasar solo lo que la página necesita', () => {
    for (const path of ['/_next/data/x.json', '/api/inquiries', '/api/public/availability', '/landings/stock/a.svg', '/favicon.ico']) {
      assert.deepEqual(customDomainRoute('tienda.com', path), { type: 'pass' }, path)
    }
  })

  it('no muestra paneles, otras páginas ni el magnet en el dominio del cliente', () => {
    for (const path of ['/app', '/app/login', '/admin', '/p/otra-tienda', '/api/leads', '/mercadosanpablosigua', '/privacidad']) {
      assert.deepEqual(customDomainRoute('tienda.com', path), { type: 'not-found' }, path)
    }
  })

  it('sirve robots y sitemap propios', () => {
    const robots = customDomainRoute('tienda.com', '/robots.txt')
    assert.equal(robots?.type, 'robots')
    assert.match(robots?.type === 'robots' ? robots.body : '', /Sitemap: https:\/\/tienda\.com\/sitemap\.xml/)
    const sitemap = customDomainRoute('tienda.com', '/sitemap.xml')
    assert.match(sitemap?.type === 'sitemap' ? sitemap.body : '', /<loc>https:\/\/tienda\.com\/<\/loc>/)
  })

  it('no toca otros hosts mientras la redirección esté apagada', () => {
    assert.equal(customDomainRoute('webycitas.humanosisu.net', '/p/mi-tienda'), null)
    assert.equal(customDomainRoute('webycitas.humanosisu.net', '/'), null)
    assert.equal(customDomainRoute('mercado.humanosisu.net', '/'), null)
  })

  it('con la redirección encendida, la dirección vieja hace 301 al dominio', () => {
    process.env.CUSTOM_DOMAIN_REDIRECT = '1'
    assert.deepEqual(customDomainRoute('webycitas.humanosisu.net', '/p/mi-tienda'), {
      type: 'redirect',
      url: 'https://tienda.com/',
    })
    assert.equal(customDomainRoute('webycitas.humanosisu.net', '/p/sin-dominio'), null)
  })

  it('canonical y enlace del panel usan el dominio propio', () => {
    assert.equal(landingPublicUrl('mi-tienda'), 'https://tienda.com/')
    assert.equal(landingPublicHref('mi-tienda'), 'https://tienda.com/')
    assert.equal(landingPublicHref('sin-dominio'), '/p/sin-dominio')
  })

  it('sin la variable no cambia nada', () => {
    delete process.env.CUSTOM_DOMAIN_SITES
    assert.equal(customDomainRoute('tienda.com', '/'), null)
    assert.equal(landingPublicHref('mi-tienda'), '/p/mi-tienda')
  })
})
