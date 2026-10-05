import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { signOutClient } from '../../lib/auth/client-session'
import { LANDINGS_ADMIN_PATH } from '../../lib/landings/paths'
import {
  OPS_ADMIN_INQUIRIES_PATH,
  OPS_ADMIN_PREFIX,
  OPS_ADMIN_SITES_PATH,
  OPS_ADMIN_USERS_PATH,
} from '../../lib/ops/paths'
import { cn } from '../../lib/utils'

const NAV = [
  { href: OPS_ADMIN_PREFIX, label: 'Leads', match: (path: string) => path === OPS_ADMIN_PREFIX },
  { href: OPS_ADMIN_SITES_PATH, label: 'Sites', match: (path: string) => path.startsWith(OPS_ADMIN_SITES_PATH) },
  {
    href: LANDINGS_ADMIN_PATH,
    label: 'Landings',
    match: (path: string) => path.startsWith(LANDINGS_ADMIN_PATH),
  },
  {
    href: OPS_ADMIN_INQUIRIES_PATH,
    label: 'Consultas',
    match: (path: string) => path.startsWith(OPS_ADMIN_INQUIRIES_PATH),
  },
  {
    href: OPS_ADMIN_USERS_PATH,
    label: 'Operadores',
    match: (path: string) => path.startsWith(OPS_ADMIN_USERS_PATH),
  },
] as const

function navClass(active: boolean) {
  return cn(
    'rounded-md px-2.5 py-1.5 text-sm transition-colors',
    active
      ? 'border border-brand-400/30 bg-brand-600/20 text-white'
      : 'text-white/65 hover:bg-white/5 hover:text-white'
  )
}

export default function OpsShell({
  operatorEmail,
  children,
}: {
  operatorEmail?: string
  children: ReactNode
}) {
  const router = useRouter()
  const path = router.pathname

  async function logout() {
    await signOutClient()
    void router.push('/app/login?redirect=/admin')
  }

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-mesh text-white">
      <header className="glass-modern sticky top-0 z-40 border-b border-white/10 shadow-glass">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">Webycitas · operador</p>
            {operatorEmail ? <p className="text-xs text-white/50">{operatorEmail}</p> : null}
          </div>
          <nav className="flex flex-wrap items-center gap-1.5">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item.match(path))}>
                {item.label}
              </Link>
            ))}
            <Link href="/" className={navClass(false)}>
              Magnet
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
