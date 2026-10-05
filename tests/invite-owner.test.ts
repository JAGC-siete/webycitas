import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ownerUpdatePasswordRedirectPath } from '../lib/auth/auth-hash'
import { authAbsoluteUrl, authRedirectOrigin } from '../lib/site'

describe('invite owner redirects', () => {
  it('authRedirectOrigin respeta SITE_URL localhost', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    assert.equal(authRedirectOrigin(), 'http://localhost:3000')
    assert.equal(
      authAbsoluteUrl(ownerUpdatePasswordRedirectPath()),
      'http://localhost:3000/auth/update-password?next=/app/login'
    )
    process.env.NEXT_PUBLIC_SITE_URL = prev
  })
})
