import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  MERCADO_ADMIN_LOGOUT_API_PATH,
  mercadoAdminListPath,
  mercadoApplicationsAdminPath,
  mercadoHomePath,
} from '../../lib/mercado/paths'
import { cn } from '../../lib/utils'

function navClass(active: boolean) {
  return cn(
    'rounded-md px-2.5 py-1.5 text-sm transition-colors',
    active
      ? 'border border-amber-400/30 bg-amber-500/15 text-amber-50'
      : 'text-white/65 hover:bg-white/5 hover:text-white'
  )
}

export default function MercadoAdminShell({
  operatorEmail,
  children,
}: {
  operatorEmail?: string
  children: ReactNode
}) {
  const router = useRouter()
  const path = router.pathname
  const listPath = mercadoAdminListPath()
  const applicationsPath = mercadoApplicationsAdminPath()

  async function logout() {
    await fetch(MERCADO_ADMIN_LOGOUT_API_PATH, { method: 'POST', credentials: 'include' })
    void router.push('/app/mercado/login')
  }

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-mesh text-white">
      <header className="glass-modern sticky top-0 z-40 border-b border-white/10 shadow-glass">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">Mercado San Pablo · operador</p>
            {operatorEmail ? <p className="text-xs text-white/50">{operatorEmail}</p> : null}
          </div>
          <nav className="flex flex-wrap items-center gap-1.5">
            <Link
              href={listPath}
              className={navClass(path.startsWith('/app/mercado/fichas') || path === listPath)}
            >
              Fichas
            </Link>
            <Link
              href={applicationsPath}
              className={navClass(path.startsWith('/app/mercado/solicitudes'))}
            >
              Solicitudes
            </Link>
            <Link href={mercadoHomePath()} className={navClass(false)}>
              Directorio
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="ml-1 rounded-md px-2.5 py-1.5 text-sm text-white/45 transition-colors hover:bg-white/5 hover:text-white/80"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-5xl">{children}</main>
    </div>
  )
}
