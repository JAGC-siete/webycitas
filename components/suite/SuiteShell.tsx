import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { signOutClient } from '../../lib/auth/client-session'
import type { SuiteTenant } from '../../lib/suite/tenant'
import {
  SUITE_CLIENTES_PATH,
  SUITE_HOME_PATH,
  SUITE_RESERVAS_PATH,
  SUITE_SITIO_PATH,
} from '../../lib/suite/paths'

export default function SuiteShell({
  tenant,
  children,
}: {
  tenant: SuiteTenant
  children: ReactNode
}) {
  const router = useRouter()
  const hasBooking = tenant.modules.includes('reservas')
  const hasSitio = tenant.modules.includes('sitio')

  async function logout() {
    await signOutClient()
    void router.push('/app/login')
  }

  const linkClass = (path: string) => {
    const active =
      path === SUITE_HOME_PATH
        ? router.pathname === SUITE_HOME_PATH
        : router.pathname === path || router.pathname.startsWith(`${path}/`)
    return active ? 'text-sky-200 underline' : 'text-sky-200/80 hover:underline'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-sm font-semibold">{tenant.businessName}</p>
            <p className="text-xs text-white/50">{tenant.email}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link href={SUITE_HOME_PATH} className={linkClass(SUITE_HOME_PATH)}>
              Panel
            </Link>
            {hasBooking ? (
              <Link href={SUITE_RESERVAS_PATH} className={linkClass(SUITE_RESERVAS_PATH)}>
                Agenda
              </Link>
            ) : null}
            {hasSitio ? (
              <Link href={SUITE_SITIO_PATH} className={linkClass(SUITE_SITIO_PATH)}>
                Mi sitio
              </Link>
            ) : null}
            {hasBooking ? (
              <Link href={SUITE_CLIENTES_PATH} className={linkClass(SUITE_CLIENTES_PATH)}>
                Clientes
              </Link>
            ) : null}
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
