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
import { cn } from '../../lib/utils'

function navClass(active: boolean) {
  return cn(
    'rounded-md px-2.5 py-1.5 text-sm transition-colors',
    active
      ? 'border border-brand-400/30 bg-brand-600/20 font-semibold text-white'
      : 'text-white/65 hover:bg-white/5 hover:text-white'
  )
}

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

  const isActive = (path: string) =>
    path === SUITE_HOME_PATH
      ? router.pathname === SUITE_HOME_PATH
      : router.pathname === path || router.pathname.startsWith(`${path}/`)

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-mesh text-white">
      <header className="glass-modern sticky top-0 z-40 border-b border-white/10 shadow-glass">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">{tenant.businessName}</p>
            <p className="text-xs text-white/50">{tenant.email}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-1.5">
            <Link href={SUITE_HOME_PATH} className={navClass(isActive(SUITE_HOME_PATH))}>
              Panel
            </Link>
            {hasBooking ? (
              <Link href={SUITE_RESERVAS_PATH} className={navClass(isActive(SUITE_RESERVAS_PATH))}>
                Agenda
              </Link>
            ) : null}
            {hasSitio ? (
              <Link href={SUITE_SITIO_PATH} className={navClass(isActive(SUITE_SITIO_PATH))}>
                Mi sitio
              </Link>
            ) : null}
            {hasInventario ? (
              <Link
                href={SUITE_INVENTARIO_PATH}
                className={navClass(isActive(SUITE_INVENTARIO_PATH))}
              >
                Inventario
              </Link>
            ) : null}
            {hasContabilidad ? (
              <Link
                href={SUITE_CONTABILIDAD_PATH}
                className={navClass(isActive(SUITE_CONTABILIDAD_PATH))}
              >
                Contabilidad
              </Link>
            ) : null}
            {hasBooking ? (
              <Link href={SUITE_CLIENTES_PATH} className={navClass(isActive(SUITE_CLIENTES_PATH))}>
                Clientes
              </Link>
            ) : null}
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
