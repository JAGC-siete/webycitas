/**
 * Hub Contabilidad: plan de cuentas, asientos, reportes.
 */

import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../components/suite/SuiteShell'
import {
  SUITE_CONTABILIDAD_ASIENTOS_PATH,
  SUITE_CONTABILIDAD_CUENTAS_PATH,
  SUITE_CONTABILIDAD_REPORTES_PATH,
} from '../../../lib/suite/paths'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'contabilidad' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

const LINKS = [
  {
    href: SUITE_CONTABILIDAD_CUENTAS_PATH,
    title: 'Plan de cuentas',
    body: 'Catálogo jerárquico. Carga la plantilla mínima o agrega cuentas.',
  },
  {
    href: SUITE_CONTABILIDAD_ASIENTOS_PATH,
    title: 'Asientos',
    body: 'Partida doble: borradores, publicación balanceada y reversos.',
  },
  {
    href: SUITE_CONTABILIDAD_REPORTES_PATH,
    title: 'Reportes',
    body: 'Balanza de comprobación, estado de resultados y balance general.',
  },
]

export default function ContabilidadHubPage({ tenant }: { tenant: SuiteTenant }) {
  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Contabilidad · {tenant.businessName}</title>
      </Head>
      <div className="space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contabilidad</h1>
          <p className="mt-1 text-sm text-white/55">
            Ledger por partida doble. Los asientos publicados no se editan: se reversan.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="glass-modern rounded-2xl p-4 transition hover:border-brand-400/40"
            >
              <p className="text-sm font-semibold text-sky-100">{item.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">{item.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </SuiteShell>
  )
}
