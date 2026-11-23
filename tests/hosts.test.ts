import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MERCADO_ADMIN_COOKIE } from '../lib/mercado/admin-auth'
import { stripSiguaPrefix } from '../lib/mercado/paths'
import { canonicalHostname, currentPathForLegacy, isSiguaHost, routeForHost } from '../lib/hosts'

const PROD = 'https://sigua-online.com'
const OLD = 'https://mercado.humanosisu.net'

describe('hosts: rutas de la marca anterior', () => {
  it('manda cada ruta vieja a su ruta nueva', () => {
    assert.equal(currentPathForLegacy('/mercadosanpablosigua'), '/')
    assert.equal(currentPathForLegacy('/mercadosanpablosigua/'), '/')
    assert.equal(currentPathForLegacy('/mercadosanpablosigua/inscripcion'), '/inscripcion')
    assert.equal(currentPathForLegacy('/mercadosanpablosigua/comedor-el-patio'), '/negocios/comedor-el-patio')
    assert.equal(currentPathForLegacy('/mercadosanpablosiguav2'), '/mercado-san-pablo')
    assert.equal(currentPathForLegacy('/mercado'), '/')
    assert.equal(currentPathForLegacy('/mercado/inscripcion'), '/inscripcion')
    assert.equal(currentPathForLegacy('/mercado/comedor-el-patio'), '/negocios/comedor-el-patio')
  })

  it('no toca rutas actuales ni los png de public/mercado', () => {
    assert.equal(currentPathForLegacy('/'), null)
    assert.equal(currentPathForLegacy('/negocios/comedor-el-patio'), null)
    assert.equal(currentPathForLegacy('/mercado-san-pablo'), null)
    assert.equal(currentPathForLegacy('/mercado/dona-marta.png'), null)
    assert.equal(currentPathForLegacy('/mercado/v2.css'), null)
    assert.equal(currentPathForLegacy('/mercaderia'), null)
    assert.equal(currentPathForLegacy('/app/mercado'), null)
  })
})

describe('hosts: qué producto atiende cada dominio', () => {
  it('reconoce los hosts del directorio', () => {
    assert.equal(isSiguaHost('sigua-online.com', PROD), true)
    assert.equal(isSiguaHost('www.sigua-online.com', PROD), true)
    assert.equal(isSiguaHost('mercado.humanosisu.net:443', OLD), true)
    assert.equal(isSiguaHost('sigua.localhost:3000', undefined), true)
    assert.equal(isSiguaHost('webycitas.humanosisu.net', PROD), false)
    assert.equal(isSiguaHost('localhost:3000', PROD), false)
    assert.equal(isSiguaHost('webycitas-production.up.railway.app', PROD), false)
  })

  it('en el directorio reescribe páginas y APIs a su carpeta interna', () => {
    assert.deepEqual(routeForHost('sigua-online.com', '/', PROD), { kind: 'rewrite', pathname: '/sigua' })
    assert.deepEqual(routeForHost('sigua-online.com', '/negocios/comedor-el-patio', PROD), {
      kind: 'rewrite',
      pathname: '/sigua/negocios/comedor-el-patio',
    })
    assert.deepEqual(routeForHost('sigua-online.com', '/app/mercado', PROD), {
      kind: 'rewrite',
      pathname: '/sigua/app/mercado',
    })
    assert.deepEqual(routeForHost('sigua-online.com', '/api/auth/login', PROD), {
      kind: 'rewrite',
      pathname: '/api/sigua/auth/login',
    })
    assert.deepEqual(routeForHost('sigua-online.com', '/robots.txt', PROD), {
      kind: 'rewrite',
      pathname: '/sigua-robots.txt',
    })
  })

  it('en el directorio deja pasar assets y el healthcheck', () => {
    assert.deepEqual(routeForHost('sigua-online.com', '/mercado/dona-marta.png', PROD), { kind: 'next' })
    assert.deepEqual(routeForHost('sigua-online.com', '/api/health', PROD), { kind: 'next' })
    assert.deepEqual(routeForHost('sigua-online.com', '/_next/data/x.json', PROD), { kind: 'next' })
  })

  it('la carpeta interna nunca es una URL pública', () => {
    assert.deepEqual(routeForHost('sigua-online.com', '/sigua/negocios/x', PROD), {
      kind: 'redirect',
      origin: null,
      pathname: '/negocios/x',
    })
    assert.deepEqual(routeForHost('sigua-online.com', '/api/sigua/auth/login', PROD), { kind: 'not_found' })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/sigua', PROD), { kind: 'not_found' })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/sigua/app/login', PROD), { kind: 'not_found' })
    assert.deepEqual(routeForHost('localhost:3000', '/api/sigua/mercado/inscriptions', PROD), {
      kind: 'not_found',
    })
    assert.equal(stripSiguaPrefix('/sigua'), '/')
    assert.equal(stripSiguaPrefix('/sigua/app/mercado'), '/app/mercado')
    assert.equal(stripSiguaPrefix('/app/mercado'), '/app/mercado')
  })

  it('Webycitas sigue igual en su host', () => {
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/', PROD), { kind: 'next' })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/app/login', PROD), { kind: 'next' })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/api/leads', PROD), { kind: 'next' })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/mercado/dona-marta.png', PROD), { kind: 'next' })
  })

  it('la copia vieja del directorio en Webycitas manda al directorio real', () => {
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/mercadosanpablosigua/comedor-el-patio', OLD), {
      kind: 'redirect',
      origin: OLD,
      pathname: '/negocios/comedor-el-patio',
    })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/mercado', PROD), {
      kind: 'redirect',
      origin: PROD,
      pathname: '/',
    })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/app/mercado/fichas', PROD), {
      kind: 'redirect',
      origin: PROD,
      pathname: '/app/mercado/fichas',
    })
    assert.deepEqual(routeForHost('localhost:3000', '/mercadosanpablosigua', undefined), { kind: 'not_found' })
  })
})

describe('hosts: cambio de dominio', () => {
  it('lee el host canónico de NEXT_PUBLIC_MERCADO_SITE_URL y lo ignora en local', () => {
    assert.equal(canonicalHostname(PROD), 'sigua-online.com')
    assert.equal(canonicalHostname('http://localhost:3000'), null)
    assert.equal(canonicalHostname(undefined), null)
    assert.equal(canonicalHostname('no es url'), null)
  })

  it('redirige el dominio viejo en un solo salto, mapeando la ruta', () => {
    assert.deepEqual(routeForHost('mercado.humanosisu.net', '/mercadosanpablosigua/comedor-el-patio', PROD), {
      kind: 'redirect',
      origin: PROD,
      pathname: '/negocios/comedor-el-patio',
    })
    assert.deepEqual(routeForHost('mercado.humanosisu.net', '/app/login', PROD), {
      kind: 'redirect',
      origin: PROD,
      pathname: '/app/login',
    })
    assert.deepEqual(routeForHost('www.sigua-online.com', '/', PROD), { kind: 'redirect', origin: PROD, pathname: '/' })
  })

  it('no mueve de dominio las APIs del dominio viejo', () => {
    assert.deepEqual(routeForHost('mercado.humanosisu.net', '/api/auth/login', PROD), {
      kind: 'rewrite',
      pathname: '/api/sigua/auth/login',
    })
  })

  it('no saca a nadie del dominio mientras NEXT_PUBLIC_MERCADO_SITE_URL siga en el viejo', () => {
    assert.deepEqual(routeForHost('mercado.humanosisu.net', '/', OLD), { kind: 'rewrite', pathname: '/sigua' })
    assert.deepEqual(routeForHost('mercado.humanosisu.net', '/mercadosanpablosigua', OLD), {
      kind: 'redirect',
      origin: null,
      pathname: '/',
    })
  })

  it('las 301 del directorio viven en middleware, no en next.config.js', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.js'), 'utf8')
    assert.equal(config.includes('mercadosanpablosigua'), false)
    const middleware = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8')
    assert.match(middleware, /routeForHost/)
    assert.match(middleware, /301/)
  })

  it('usa cookie propia del operador', () => {
    assert.equal(MERCADO_ADMIN_COOKIE, 'mercado_op')
  })
})
