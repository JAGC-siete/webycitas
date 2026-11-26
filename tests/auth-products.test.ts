import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureVendorProfile } from '../lib/auth/claim-vendor'
import { normalizeEmail, normalizePassword } from '../lib/auth/credentials'
import {
  PRODUCT_ROLES,
  canUseProduct,
  directoryPostLoginPath,
  postLoginPathFor,
} from '../lib/auth/role-access'
import { APP_LOGIN_PATH, appLoginPath } from '../lib/mercado/paths'
import { MERCADO_ADMIN_COOKIE } from '../lib/mercado/admin-auth'

const active = (role: string) => ({ role, is_active: true })

describe('login único: quién entra a cada producto', () => {
  it('Webycitas: super_admin y owner', () => {
    assert.deepEqual([...PRODUCT_ROLES.webycitas], ['super_admin', 'owner'])
    assert.equal(canUseProduct(active('super_admin'), 'webycitas'), true)
    assert.equal(canUseProduct(active('owner'), 'webycitas'), true)
    assert.equal(canUseProduct(active('vendor'), 'webycitas'), false)
  })

  it('directorio: super_admin y vendor', () => {
    assert.deepEqual([...PRODUCT_ROLES.directory], ['super_admin', 'vendor'])
    assert.equal(canUseProduct(active('super_admin'), 'directory'), true)
    assert.equal(canUseProduct(active('vendor'), 'directory'), true)
    assert.equal(canUseProduct(active('owner'), 'directory'), false)
  })

  it('nadie inactivo ni con rol desconocido', () => {
    assert.equal(canUseProduct({ role: 'vendor', is_active: false }, 'directory'), false)
    assert.equal(canUseProduct(active('hr_manager'), 'directory'), false)
    assert.equal(canUseProduct(null, 'webycitas'), false)
  })
})

describe('login único: a dónde llega cada rol', () => {
  it('directorio: operador a /app/mercado, dueño a /app', () => {
    assert.equal(directoryPostLoginPath('super_admin', null), '/app/mercado')
    assert.equal(directoryPostLoginPath('super_admin', '/app/mercado/solicitudes'), '/app/mercado/solicitudes')
    assert.equal(directoryPostLoginPath('super_admin', '/app/mercado/login'), '/app/mercado')
    assert.equal(directoryPostLoginPath('super_admin', '//evil.example/app/mercado'), '/app/mercado')
    assert.equal(directoryPostLoginPath('vendor', '/app/mercado/fichas'), '/app')
  })

  it('Webycitas sigue igual', () => {
    assert.equal(postLoginPathFor('webycitas', 'super_admin', null), '/admin')
    assert.equal(postLoginPathFor('webycitas', 'super_admin', '/admin/sites'), '/admin/sites')
    assert.equal(postLoginPathFor('webycitas', 'owner', '/app/reservas'), '/app/reservas')
    assert.equal(postLoginPathFor('webycitas', 'owner', '/app/mercado'), '/app')
  })

  it('normaliza correo y contraseña igual en los dos hosts', () => {
    assert.equal(normalizeEmail('  Foo@Bar.COM​ '), 'foo@bar.com')
    assert.equal(normalizePassword('secret​'), 'secret')
  })

  it('login canónico del directorio y cookie HMAC residual', () => {
    assert.equal(APP_LOGIN_PATH, '/app/login')
    assert.equal(appLoginPath('/app/mercado'), '/app/login?redirect=%2Fapp%2Fmercado')
    assert.equal(MERCADO_ADMIN_COOKIE, 'mercado_op')
  })
})

function fakeAdmin(existingRole: string | null) {
  const upserts: { row: unknown; options: Record<string, unknown> }[] = []
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: existingRole ? { role: existingRole } : null, error: null }),
        }),
      }),
      upsert: (row: unknown, options: Record<string, unknown>) => {
        upserts.push({ row, options })
        return Promise.resolve({ error: null })
      },
    }),
  } as unknown as SupabaseClient
  return { admin, upserts }
}

describe('invitar dueño del directorio no pisa otra cuenta', () => {
  it('crea el perfil vendor si no hay ninguno, sin sobrescribir', async () => {
    const { admin, upserts } = fakeAdmin(null)
    assert.deepEqual(await ensureVendorProfile(admin, 'user-1'), { ok: true })
    assert.equal(upserts.length, 1)
    assert.equal(upserts[0].options.ignoreDuplicates, true)
  })

  it('acepta un vendor que ya existe', async () => {
    const { admin, upserts } = fakeAdmin('vendor')
    assert.deepEqual(await ensureVendorProfile(admin, 'user-1'), { ok: true })
    assert.equal(upserts.length, 0)
  })

  it('no toca a un owner de Webycitas ni al operador', async () => {
    for (const role of ['owner', 'super_admin']) {
      const { admin, upserts } = fakeAdmin(role)
      assert.deepEqual(await ensureVendorProfile(admin, 'user-1'), { ok: false, existingRole: role })
      assert.equal(upserts.length, 0)
    }
  })
})

describe('la base acepta los mismos roles que el código', () => {
  it('la última regla de roles de site_user_profiles lista APP_ROLES', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { APP_ROLES } = await import('../lib/auth/role-access')
    const dir = join(process.cwd(), 'supabase/migrations')
    const latest = readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => readFileSync(join(dir, file), 'utf8'))
      .filter((sql) => /CONSTRAINT user_profiles_role_check CHECK/.test(sql))
      .pop()
    assert.ok(latest)
    const allowed = /user_profiles_role_check CHECK \(role IN \(([^)]*)\)\)/.exec(latest)?.[1] ?? ''
    assert.deepEqual(
      allowed.split(',').map((role) => role.trim().replace(/'/g, '')).sort(),
      [...APP_ROLES].sort()
    )
  })
})
