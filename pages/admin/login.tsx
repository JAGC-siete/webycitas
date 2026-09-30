import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { OPS_ADMIN_LOGIN_API_PATH, OPS_ADMIN_PREFIX, isOpsAdminPath } from '../../lib/ops/paths'

export default function OpsLoginPage() {
  const router = useRouter()
  const requested = typeof router.query.next === 'string' ? router.query.next : ''
  const next = isOpsAdminPath(requested) && !requested.startsWith('/admin/login') ? requested : OPS_ADMIN_PREFIX
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(OPS_ADMIN_LOGIN_API_PATH, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo entrar')
      void router.replace(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Head>
        <title>Operador Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-white">Operador de Webycitas</CardTitle>
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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
