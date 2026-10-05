import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { signOutClient } from '../../lib/auth/client-session'
import type { SuiteTenant } from '../../lib/suite/tenant'
import {
  SUITE_CLIENTES_PATH,
  SUITE_CONTABILIDAD_PATH,
  SUITE_HOME_PATH,
  SUITE_INVENTARIO_PATH,
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
  const hasInventario = tenant.modules.includes('inventario')
  const hasContabilidad = tenant.modules.includes('contabilidad')

  async function logout() {
    await signOutClient()
    void router.push('/app/login')
  }

  const navClass = (path: string) => {
    const active =
      path === SUITE_HOME_PATH
        ? router.pathname === SUITE_HOME_PATH
        : router.pathname === path || router.pathname.startsWith(`${path}/`)
    return active
      ? 'rounded-md bg-sky-500/20 px-2.5 py-1.5 text-sm font-semibold text-sky-100'
      : 'rounded-md px-2.5 py-1.5 text-sm text-white/65 hover:bg-white/5 hover:text-white'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-sm font-semibold">{tenant.businessName}</p>
            <p className="text-xs text-white/50">{tenant.email}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <Link href={SUITE_HOME_PATH} className={navClass(SUITE_HOME_PATH)}>
              Panel
            </Link>
            {hasBooking ? (
              <Link href={SUITE_RESERVAS_PATH} className={navClass(SUITE_RESERVAS_PATH)}>
                Agenda
              </Link>
            ) : null}
            {hasSitio ? (
              <Link href={SUITE_SITIO_PATH} className={navClass(SUITE_SITIO_PATH)}>
                Mi sitio
              </Link>
            ) : null}
            {hasInventario ? (
              <Link href={SUITE_INVENTARIO_PATH} className={navClass(SUITE_INVENTARIO_PATH)}>
                Inventario
              </Link>
            ) : null}
            {hasContabilidad ? (
              <Link href={SUITE_CONTABILIDAD_PATH} className={navClass(SUITE_CONTABILIDAD_PATH)}>
                Contabilidad
              </Link>
            ) : null}
            {hasBooking ? (
              <Link href={SUITE_CLIENTES_PATH} className={navClass(SUITE_CLIENTES_PATH)}>
                Clientes
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void logout()}
              className="ml-1 rounded-md px-2.5 py-1.5 text-sm text-white/45 hover:bg-white/5 hover:text-white/80"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl">{children}</main>
    </div>
  )
}
