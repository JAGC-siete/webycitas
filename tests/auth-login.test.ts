import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail, normalizePassword } from '../lib/auth/credentials'
import {
  canLoginToApp,
  isSafeAppRedirect,
  loginPath,
  postLoginPath,
} from '../lib/auth/role-access'
import { consumeRateLimit } from '../lib/rate-limit'
import { APP_LOGIN_PATH, opsAdminLoginPath } from '../lib/ops/paths'

describe('login unificado Webycitas', () => {
  it('normaliza email y quita whitespace invisible del password', () => {
    assert.equal(normalizeEmail('  Ops@Webycitas.COM  '), 'ops@webycitas.com')
    assert.equal(normalizePassword('\u200Bsecreto\u00A0'), 'secreto')
    assert.equal(normalizePassword('cla ve'), 'cla ve')
  })

  it('canLoginToApp solo admite super_admin y owner activos', () => {
    assert.equal(canLoginToApp({ role: 'super_admin', is_active: true }), true)
    assert.equal(canLoginToApp({ role: 'owner', is_active: true }), true)
    assert.equal(canLoginToApp({ role: 'owner', is_active: false }), false)
    assert.equal(canLoginToApp({ role: 'hr_manager', is_active: true }), false)
    assert.equal(canLoginToApp(null), false)
  })

  it('postLoginPath separa super_admin y owner', () => {
    assert.equal(postLoginPath('super_admin', '/admin/sites'), '/admin/sites')
    assert.equal(postLoginPath('super_admin', '/app'), '/admin')
    assert.equal(postLoginPath('super_admin'), '/admin')
    assert.equal(postLoginPath('owner', '/admin'), '/app')
    assert.equal(postLoginPath('owner', 'https://evil.test'), '/app')
  })

  it('rechaza redirects abiertos y Mercado', () => {
    assert.equal(isSafeAppRedirect('/admin/sites'), true)
    assert.equal(isSafeAppRedirect('/app'), true)
    assert.equal(isSafeAppRedirect('//evil.test'), false)
    assert.equal(isSafeAppRedirect('/app/mercado/fichas'), false)
    assert.equal(loginPath('/admin'), '/app/login?redirect=%2Fadmin')
  })

  it('/admin/login apunta al login unificado', () => {
    assert.equal(APP_LOGIN_PATH, '/app/login')
    assert.equal(opsAdminLoginPath('/admin/sites'), '/app/login?redirect=%2Fadmin%2Fsites')
    assert.equal(opsAdminLoginPath('/app/mercado/fichas'), '/app/login?redirect=%2Fadmin')
    assert.equal(opsAdminLoginPath('/admin/login'), '/app/login?redirect=%2Fadmin')
  })

  it('rate limit por clave IP y IP+email', () => {
    const key = `test:${Date.now()}`
    assert.equal(consumeRateLimit(key, { windowMs: 60_000, max: 2 }), true)
    assert.equal(consumeRateLimit(key, { windowMs: 60_000, max: 2 }), true)
    assert.equal(consumeRateLimit(key, { windowMs: 60_000, max: 2 }), false)
  })
})
