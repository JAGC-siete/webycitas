import { useEffect, useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { persistLogin } from '../../lib/auth/client-session'
import { normalizeEmail, normalizePassword } from '../../lib/auth/credentials'
import { isAppRole, isSafeAppRedirect, postLoginPath, type AppRole } from '../../lib/auth/role-access'
import { createBrowserSupabase } from '../../lib/supabase/browser'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'

interface LoginResponse {
  error?: string
  user?: {
    id: string
    email: string
    role: AppRole
    lead_id: string | null
    session_id?: string
    session_token?: string
  }
  session?: {
    access_token: string
    refresh_token: string
  }
}

function requestedRedirect(query: Record<string, string | string[] | undefined>): string | undefined {
  const raw = query.redirect ?? query.next
  const value = Array.isArray(raw) ? raw[0] : raw
  return value && isSafeAppRedirect(value) ? value : undefined
}

export default function AppLoginPage() {
  const router = useRouter()
  const redirect = requestedRedirect(router.query)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (router.query.error === 'link_expired') {
      setError('El enlace de acceso expiró o ya se usó. Pedí otra invitación desde el panel ops.')
    }
  }, [router.query.error])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizeEmail(email),
          password: normalizePassword(password),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as LoginResponse
      if (!res.ok || !body.user || !body.session || !isAppRole(body.user.role)) {
        throw new Error(body.error || 'Credenciales inválidas')
      }
      persistLogin(body.user)
      const supabase = createBrowserSupabase()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: body.session.access_token,
        refresh_token: body.session.refresh_token,
      })
      if (sessionError) throw sessionError
      void router.replace(postLoginPath(body.user.role, redirect))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Head>
        <title>Iniciar sesión · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-white">Iniciar sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
            <label className="block text-sm text-gray-200">
              Correo
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 bg-white/10 text-white"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm text-gray-200">
              Contraseña
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 bg-white/10 text-white"
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </Button>
            <p className="text-sm text-white/60">
              <Link href="/app/forgot-password" className="text-sky-200 hover:underline">
                Olvidé mi contraseña
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
