import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MERCADO_ADMIN_COOKIE } from '../lib/mercado/admin-auth'
import { rewritePathForHost } from '../lib/hosts'
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

  it('mercado.humanosisu.net abre el directorio en /', () => {
    assert.equal(rewritePathForHost('mercado.humanosisu.net', '/'), '/mercadosanpablosigua')
    assert.equal(rewritePathForHost('mercado.humanosisu.net:443', '/admin'), null)
    assert.equal(rewritePathForHost('webycitas.humanosisu.net', '/'), null)
    assert.equal(rewritePathForHost('humanosisu.net', '/'), null)
  })

  it('aísla superficies de producto Webycitas vs Mercado', () => {
    assert.equal(PRODUCT_SURFACES.webycitas.brand, 'Webycitas')
    assert.equal(PRODUCT_SURFACES.mercado.brand, 'Mercado San Pablo')
    assert.equal(isMercadoPublicPath('/mercadosanpablosigua'), true)
    assert.equal(isMercadoPublicPath('/'), false)
  })
})
