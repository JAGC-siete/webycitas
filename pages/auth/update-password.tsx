import { useEffect, useState, type FormEvent } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { normalizePassword } from '../../lib/auth/credentials'
import { createBrowserSupabase } from '../../lib/supabase/browser'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const next = typeof router.query.next === 'string' && router.query.next.startsWith('/app/login')
    ? router.query.next
    : '/app/login'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabase()
    let cancelled = false

    async function hydrateFromUrl() {
      // Invite/recovery: tokens en #access_token=... (detectSessionInUrl)
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data.session) {
        setReady(true)
        return
      }
      // Reintento corto: el parse del hash a veces llega un tick después
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      const again = await supabase.auth.getSession()
      if (!cancelled) setReady(Boolean(again.data.session))
    }

    void hydrateFromUrl()
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setReady(true)
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextPassword = normalizePassword(password)
    if (nextPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (nextPassword !== normalizePassword(confirm)) {
      setError('Las contraseñas no coinciden')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const supabase = createBrowserSupabase()
      const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      void router.replace(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Head>
        <title>Nueva contraseña · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-white">Nueva contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-white/70">Abre el enlace del correo para continuar.</p>
          ) : (
            <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
              <label className="block text-sm text-gray-200">
                Contraseña
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 bg-white/10 text-white"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm text-gray-200">
                Confirmar
                <Input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="mt-1 bg-white/10 text-white"
                  autoComplete="new-password"
                />
              </label>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
