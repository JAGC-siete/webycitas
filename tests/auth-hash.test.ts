import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ownerUpdatePasswordRedirectPath,
  parseAuthHash,
  updatePasswordHashTarget,
} from '../lib/auth/auth-hash'
import { authAbsoluteUrl, authRedirectOrigin } from '../lib/site'

describe('auth hash invite handoff', () => {
  it('parseAuthHash detecta token y errores', () => {
    assert.deepEqual(parseAuthHash('#access_token=abc&type=invite'), {
      error: null,
      hasAccessToken: true,
    })
    assert.equal(parseAuthHash('#error=access_denied&error_code=otp_expired').error, 'access_denied')
    assert.equal(parseAuthHash('').hasAccessToken, false)
  })

  it('updatePasswordHashTarget preserva el hash completo', () => {
    const hash = '#access_token=tok&refresh_token=r&type=invite'
    assert.equal(
      updatePasswordHashTarget(hash),
      `/auth/update-password?next=${encodeURIComponent('/app/login')}${hash}`
    )
  })

  it('owner redirectTo incluye next=/app/login', () => {
    assert.equal(ownerUpdatePasswordRedirectPath(), '/auth/update-password?next=/app/login')
    const prev = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = 'https://webycitas.humanosisu.net'
    assert.equal(authRedirectOrigin(), 'https://webycitas.humanosisu.net')
    assert.equal(
      authAbsoluteUrl(ownerUpdatePasswordRedirectPath()),
      'https://webycitas.humanosisu.net/auth/update-password?next=/app/login'
    )
    process.env.NEXT_PUBLIC_SITE_URL = prev
  })
})
