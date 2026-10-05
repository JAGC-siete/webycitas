import { useEffect, useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { EmailOtpType } from '@supabase/supabase-js'
import { persistLogin } from '../../lib/auth/client-session'
import { normalizePassword } from '../../lib/auth/credentials'
import { isAppRole, isSafeAppRedirect, postLoginPath, type AppRole } from '../../lib/auth/role-access'
import { createBrowserSupabase } from '../../lib/supabase/browser'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'

type Gate = 'loading' | 'ready' | 'expired'

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

const SESSION_WAIT_MS = 2000

function asOtpType(value: unknown): EmailOtpType {
  if (value === 'recovery' || value === 'invite' || value === 'email' || value === 'magiclink') {
    return value
  }
  return 'invite'
}

export default function UpdatePasswordPage() {
  const router = useRouter()
  const nextQuery = typeof router.query.next === 'string' ? router.query.next : undefined
  const loginFallback =
    nextQuery && nextQuery.startsWith('/app/login') ? nextQuery : '/app/login'
  const tokenHash = typeof router.query.token_hash === 'string' ? router.query.token_hash : null
  const otpType = asOtpType(router.query.type)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [gate, setGate] = useState<Gate>('loading')

  useEffect(() => {
    if (!router.isReady) return

    // token_hash: no verificar hasta el submit (anti-prefetch de scanners).
    if (tokenHash) {
      setGate('ready')
      return
    }

    const supabase = createBrowserSupabase()
    let cancelled = false
    let ready = false

    const markReady = () => {
      if (cancelled || ready) return
      ready = true
      setGate('ready')
    }

    async function hydrateFromUrl() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        markReady()
        return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      const again = await supabase.auth.getSession()
      if (cancelled) return
      if (again.data.session) {
        markReady()
        return
      }
      await new Promise((resolve) => window.setTimeout(resolve, SESSION_WAIT_MS - 250))
      if (cancelled || ready) return
      const last = await supabase.auth.getSession()
      if (cancelled) return
      if (last.data.session) markReady()
      else setGate('expired')
    }

    void hydrateFromUrl()
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        markReady()
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [router.isReady, tokenHash])

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

      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        })
        if (verifyError) {
          setGate('expired')
          throw new Error(
            'El enlace expiró o ya se usó. Pedí otro enlace o usá “Olvidé mi contraseña”.'
          )
        }
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const email = sessionData.session?.user?.email
      if (!email) throw new Error('Sesión de invitación no encontrada. Pedí otro enlace.')

      const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword })
      if (updateError) throw updateError

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: nextPassword }),
      })
      const body = (await res.json().catch(() => ({}))) as LoginResponse
      if (!res.ok || !body.user || !body.session || !isAppRole(body.user.role)) {
        setError(
          body.error ||
            'Contraseña guardada. Entrá con tu correo en el login (el acceso automático falló).'
        )
        window.setTimeout(() => {
          void router.replace(loginFallback)
        }, 1800)
        return
      }

      persistLogin(body.user)
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: body.session.access_token,
        refresh_token: body.session.refresh_token,
      })
      if (sessionError) throw sessionError

      const redirect =
        nextQuery && isSafeAppRedirect(nextQuery) && !nextQuery.startsWith('/app/login')
          ? nextQuery
          : undefined
      void router.replace(postLoginPath(body.user.role, redirect))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Head>
        <title>Crear contraseña · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-white">Crear contraseña y entrar</CardTitle>
        </CardHeader>
        <CardContent>
          {gate === 'loading' ? (
            <p className="text-sm text-white/70">Validando el enlace de acceso…</p>
          ) : null}

          {gate === 'expired' ? (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                El enlace expiró o ya se usó. Pedí otro enlace al operador o restablecé la contraseña
                desde el login.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/app/forgot-password">
                  <Button type="button">Olvidé mi contraseña</Button>
                </Link>
                <Link href="/app/login">
                  <Button type="button" variant="outline">
                    Ir al login
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}

          {gate === 'ready' ? (
            <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
              {tokenHash ? (
                <p className="text-xs text-white/50">
                  El acceso se activa al guardar la contraseña (no al abrir el correo).
                </p>
              ) : null}
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
                {busy ? 'Entrando…' : 'Crear contraseña y entrar'}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
