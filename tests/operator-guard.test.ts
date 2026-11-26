import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isStoredSuperAdmin, type StoredUser } from '../lib/auth/client-session'

const stored = (role: StoredUser['role']): StoredUser => ({
  id: '00000000-0000-0000-0000-000000000001',
  email: 'operador@example.com',
  role,
  lead_id: null,
})

describe('guardia de pantallas de operador en el navegador', () => {
  it('deja pasar al operador aunque el login guardado no traiga is_active', () => {
    assert.equal(isStoredSuperAdmin(stored('super_admin')), true)
  })

  it('no deja pasar a dueños, locatarios ni a quien no inició sesión', () => {
    assert.equal(isStoredSuperAdmin(stored('owner')), false)
    assert.equal(isStoredSuperAdmin(stored('vendor')), false)
    assert.equal(isStoredSuperAdmin(null), false)
  })
})
