import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  OPS_ADMIN_INQUIRIES_PATH,
  OPS_ADMIN_LOGOUT_API_PATH,
  OPS_ADMIN_PREFIX,
  OPS_ADMIN_SITES_PATH,
} from '../../lib/ops/paths'

export default function OpsShell({
  operatorEmail,
  children,
}: {
  operatorEmail?: string
  children: ReactNode
}) {
  const router = useRouter()

  async function logout() {
    await fetch(OPS_ADMIN_LOGOUT_API_PATH, { method: 'POST', credentials: 'include' })
    void router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-sm font-semibold">Webycitas · operador</p>
            {operatorEmail ? <p className="text-xs text-white/50">{operatorEmail}</p> : null}
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link href={OPS_ADMIN_PREFIX} className="text-sky-200 hover:underline">
              Leads
            </Link>
            <Link href={OPS_ADMIN_SITES_PATH} className="text-sky-200 hover:underline">
              Sites
            </Link>
            <Link href={OPS_ADMIN_INQUIRIES_PATH} className="text-sky-200 hover:underline">
              Consultas
            </Link>
            <Link href="/" className="text-white/60 hover:underline">
              Magnet
            </Link>
            <button type="button" onClick={() => void logout()} className="text-white/50 hover:text-white">
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl">{children}</main>
    </div>
  )
}
