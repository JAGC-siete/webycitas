import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MERCADO_ADMIN_COOKIE } from '../lib/mercado/admin-auth'
import { routeForHost } from '../lib/hosts'
import { OPS_ADMIN_COOKIE } from '../lib/ops/admin-auth'
import {
  OPS_ADMIN_INQUIRIES_PATH,
  OPS_ADMIN_PREFIX,
  OPS_ADMIN_SITES_PATH,
  OPS_ADMIN_USERS_PATH,
  isOpsAdminPath,
  opsAdminLoginPath,
} from '../lib/ops/paths'
import { PRODUCT_SURFACES, isMercadoPublicPath } from '../lib/product-surfaces'

describe('operador de Webycitas', () => {
  it('usa cookie distinta a la del operador de Mercado', () => {
    assert.notEqual(OPS_ADMIN_COOKIE, MERCADO_ADMIN_COOKIE)
    assert.equal(OPS_ADMIN_COOKIE, 'webycitas_ops')
  })

  it('el login solo acepta volver al panel de Webycitas', () => {
    assert.equal(opsAdminLoginPath('/admin/sites'), '/app/login?redirect=%2Fadmin%2Fsites')
    assert.equal(opsAdminLoginPath('/app/mercado/fichas'), '/app/login?redirect=%2Fadmin')
    assert.equal(opsAdminLoginPath('/admin/login'), '/app/login?redirect=%2Fadmin')
    assert.equal(isOpsAdminPath(OPS_ADMIN_PREFIX), true)
    assert.equal(isOpsAdminPath(OPS_ADMIN_SITES_PATH), true)
    assert.equal(isOpsAdminPath(OPS_ADMIN_INQUIRIES_PATH), true)
    assert.equal(isOpsAdminPath(OPS_ADMIN_USERS_PATH), true)
    assert.equal(isOpsAdminPath('/app/mercado/fichas'), false)
  })

  it('el panel de Webycitas no existe en el host del directorio', () => {
    assert.deepEqual(routeForHost('mercado.humanosisu.net', '/', undefined), { kind: 'rewrite', pathname: '/sigua' })
    assert.deepEqual(routeForHost('mercado.humanosisu.net:443', '/admin', undefined), {
      kind: 'rewrite',
      pathname: '/sigua/admin',
    })
    assert.deepEqual(routeForHost('webycitas.humanosisu.net', '/admin', undefined), { kind: 'next' })
    assert.deepEqual(routeForHost('humanosisu.net', '/', undefined), { kind: 'next' })
  })

  it('aísla superficies de producto Webycitas vs Mercado', () => {
    assert.equal(PRODUCT_SURFACES.webycitas.brand, 'Webycitas')
    assert.equal(PRODUCT_SURFACES.mercado.brand, 'Mercado Digital de Siguatepeque')
    assert.equal(isMercadoPublicPath('/sigua/negocios/[slug]'), true)
    assert.equal(isMercadoPublicPath('/'), false)
    assert.equal(isMercadoPublicPath('/siguatepeque'), false)
  })
})
