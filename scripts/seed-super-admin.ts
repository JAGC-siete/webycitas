/**
 * Alta one-shot del primer super_admin. Email/password solo por env.
 *   WEBYCITAS_SUPERADMIN_EMAIL
 *   WEBYCITAS_SUPERADMIN_PASSWORD
 * Fallback de corte: WEBYCITAS_ADMIN_EMAIL / WEBYCITAS_ADMIN_PASSWORD.
 */
import { createClient } from '@supabase/supabase-js'

function requiredEnv(name: string, fallback?: string): string {
  const value = (process.env[name] || fallback || '').trim()
  if (!value) throw new Error(`Falta ${name}`)
  return value
}

async function main() {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const email = requiredEnv(
    'WEBYCITAS_SUPERADMIN_EMAIL',
    process.env.WEBYCITAS_ADMIN_EMAIL
  ).toLowerCase()
  const password = requiredEnv(
    'WEBYCITAS_SUPERADMIN_PASSWORD',
    process.env.WEBYCITAS_ADMIN_PASSWORD
  )
  if (!email.includes('@')) throw new Error('Email de super_admin inválido')
  if (password.length < 8) throw new Error('Password de super_admin: mínimo 8')

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'super_admin' },
  })

  let userId = created.data.user?.id ?? null
  if (created.error || !userId) {
    const existing = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })
    userId = existing.data.user?.id ?? null
    if (!userId) {
      throw new Error(created.error?.message || existing.error?.message || 'No se pudo crear el usuario')
    }
    const updated = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: { role: 'super_admin' },
    })
    if (updated.error) throw updated.error
  }

  const { error: profileError } = await admin.from('user_profiles').upsert(
    { id: userId, role: 'super_admin', is_active: true, permissions: {} },
    { onConflict: 'id' }
  )
  if (profileError) throw profileError

  process.stdout.write(`super_admin listo: ${email}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : 'seed falló'}\n`)
  process.exit(1)
})
