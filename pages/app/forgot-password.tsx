import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { normalizeEmail } from '../../lib/auth/credentials'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo enviar el correo')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Head>
        <title>Recuperar contraseña · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-white">Recuperar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-sm text-white/80">
              Si el correo existe, vas a recibir un enlace para crear una contraseña nueva.
            </p>
          ) : (
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
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Enviando…' : 'Enviar enlace'}
              </Button>
            </form>
          )}
          <p className="mt-4 text-sm text-white/60">
            <Link href="/app/login" className="text-sky-200 hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
