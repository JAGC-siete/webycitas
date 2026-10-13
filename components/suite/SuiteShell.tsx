import { useEffect, useRef, type ReactNode } from 'react'
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
    'shrink-0 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
    active
      ? 'border-brand-400/30 bg-brand-600/20 font-semibold text-white'
      : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white'
  )
}

export default function SuiteShell({
  tenant,
  children,
  wide = false,
}: {
  tenant: SuiteTenant
  children: ReactNode
  /** Pantallas de dos columnas (editor + vista previa) que necesitan todo el ancho. */
  wide?: boolean
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

  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // En celular, la sección actual puede quedar fuera de la fila: la centramos.
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft
    nav.scrollLeft = left - (nav.clientWidth - active.offsetWidth) / 2
  }, [router.pathname])

  const links = [
    { href: SUITE_HOME_PATH, label: 'Panel', show: true },
    { href: SUITE_RESERVAS_PATH, label: 'Agenda', show: hasBooking },
    { href: SUITE_SITIO_PATH, label: 'Mi sitio', show: hasSitio },
    { href: SUITE_INVENTARIO_PATH, label: 'Inventario', show: hasInventario },
    { href: SUITE_CONTABILIDAD_PATH, label: 'Contabilidad', show: hasContabilidad },
    { href: SUITE_CLIENTES_PATH, label: 'Clientes', show: hasBooking },
  ].filter((link) => link.show)

  const isActive = (path: string) =>
    path === SUITE_HOME_PATH
      ? router.pathname === SUITE_HOME_PATH
      : router.pathname === path || router.pathname.startsWith(`${path}/`)

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-mesh text-white">
      <header className="glass-modern top-0 z-40 border-b border-white/10 shadow-glass lg:sticky">
        <div
          className={cn(
            'mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3',
            wide ? 'max-w-[1600px]' : 'max-w-5xl'
          )}
        >
          <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:block sm:w-auto">
            <p className="truncate text-sm font-semibold tracking-tight">{tenant.businessName}</p>
            <p className="hidden truncate text-xs text-white/50 sm:block">{tenant.email}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:hidden"
            >
              Salir
            </button>
          </div>
          {/* En celular: una sola fila que se desliza de lado, en vez de dos filas de enlaces. */}
          <nav
            ref={navRef}
            aria-label="Secciones del panel"
            className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1.5 overflow-x-auto whitespace-nowrap px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            {links.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={navClass(active)}
                >
                  {link.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => void logout()}
              className="ml-1 hidden rounded-md px-2.5 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:inline-block"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className={cn('relative z-10 mx-auto', wide ? 'max-w-[1600px]' : 'max-w-5xl')}>
        {children}
      </main>
    </div>
  )
}
