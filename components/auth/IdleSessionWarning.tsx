import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { readSessionToken, signOutClient } from '../../lib/auth/client-session'
import { loginPath } from '../../lib/auth/role-access'
import { SESSION_WARN_MS } from '../../lib/auth/session-manager'

function shouldWatch(pathname: string): boolean {
  if (pathname.startsWith('/app/mercado')) return false
  if (pathname === '/app/login' || pathname.startsWith('/app/login/')) return false
  if (pathname === '/app/forgot-password') return false
  if (pathname === '/admin/login') return false
  if (pathname.startsWith('/auth/')) return false
  return pathname === '/app' || pathname.startsWith('/app/') || pathname === '/admin' || pathname.startsWith('/admin/')
}

export default function IdleSessionWarning() {
  const router = useRouter()
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (!shouldWatch(router.pathname)) {
      setRemainingMs(null)
      return
    }

    let cancelled = false

    async function beat() {
      const token = readSessionToken()
      if (!token) return
      const res = await fetch('/api/auth/heartbeat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token }),
      })
      if (cancelled) return
      if (res.status === 401 || res.status === 440) {
        await signOutClient()
        void router.replace(loginPath(router.asPath.split('?')[0]))
        return
      }
      if (!res.ok) return
      const body = (await res.json().catch(() => ({}))) as { idle_remaining_ms?: number }
      if (typeof body.idle_remaining_ms === 'number') setRemainingMs(body.idle_remaining_ms)
    }

    void beat()
    const id = window.setInterval(() => {
      void beat()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [router, router.pathname])

  if (remainingMs === null || remainingMs > SESSION_WARN_MS) return null

  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000))

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm text-slate-950">
      La sesión se cierra por inactividad en {minutes} min. Movete en la página para mantenerla.
    </div>
  )
}
