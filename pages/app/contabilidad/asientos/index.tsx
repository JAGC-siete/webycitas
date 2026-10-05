/**
 * Listado de asientos + alta rápida de borrador.
 */

import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../../components/suite/SuiteShell'
import { Button } from '../../../../components/ui/button'
import { fetchAccountingJournals } from '../../../../lib/suite/accounting-api'
import { ENTRY_STATUS_LABELS, type AccountingJournalEntry } from '../../../../lib/suite/accounting/types'
import { formatLempirasFromCents } from '../../../../lib/suite/schemas'
import {
  SUITE_CONTABILIDAD_ASIENTOS_PATH,
  SUITE_CONTABILIDAD_PATH,
} from '../../../../lib/suite/paths'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../../lib/suite/tenant'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'contabilidad' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

function entryTotals(entry: AccountingJournalEntry) {
  const lines = entry.accounting_journal_lines ?? []
  const debit = lines.reduce((s, l) => s + l.debit_cents, 0)
  const credit = lines.reduce((s, l) => s + l.credit_cents, 0)
  return { debit, credit }
}

export default function ContabilidadAsientosPage({ tenant }: { tenant: SuiteTenant }) {
  const [entries, setEntries] = useState<AccountingJournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAccountingJournals(status ? { status } : undefined)
      setEntries(data.entries)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Asientos · {tenant.businessName}</title>
      </Head>
      <div className="space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href={SUITE_CONTABILIDAD_PATH} className="text-xs text-sky-300/80 hover:text-sky-200">
              ← Contabilidad
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">Asientos</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="posted">Publicado</option>
              <option value="reversed">Reversado</option>
            </select>
            <Link href={`${SUITE_CONTABILIDAD_ASIENTOS_PATH}/nuevo`}>
              <Button type="button">Nuevo asiento</Button>
            </Link>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {loading ? <p className="text-sm text-white/50">Cargando…</p> : null}

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Glosa</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Débitos</th>
                <th className="px-3 py-2 text-right">Créditos</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const totals = entryTotals(entry)
                return (
                  <tr key={entry.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono text-white/70">{entry.entry_date}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`${SUITE_CONTABILIDAD_ASIENTOS_PATH}/${entry.id}`}
                        className="text-sky-200 hover:text-sky-100"
                      >
                        {entry.description}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-white/60">
                      {ENTRY_STATUS_LABELS[entry.status]}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-white/70">
                      {formatLempirasFromCents(totals.debit)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-white/70">
                      {formatLempirasFromCents(totals.credit)}
                    </td>
                  </tr>
                )
              })}
              {!loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-white/45">
                    Sin asientos todavía.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </SuiteShell>
  )
}
