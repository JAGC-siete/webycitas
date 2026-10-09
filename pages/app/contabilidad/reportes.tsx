/**
 * Reportes: Trial Balance, P&L, Balance Sheet.
 */

import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../components/suite/SuiteShell'
import { Button } from '../../../components/ui/button'
import {
  fetchBalanceSheet,
  fetchProfitLoss,
  fetchTrialBalance,
} from '../../../lib/suite/accounting-api'
import { formatLempirasFromCents } from '../../../lib/suite/schemas'
import { SUITE_CONTABILIDAD_PATH } from '../../../lib/suite/paths'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'

type Tab = 'trial' | 'pl' | 'bs'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yearStartIso(): string {
  return `${new Date().getFullYear()}-01-01`
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'contabilidad' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function ContabilidadReportesPage({ tenant }: { tenant: SuiteTenant }) {
  const [tab, setTab] = useState<Tab>('trial')
  const [asOf, setAsOf] = useState(todayIso())
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trial, setTrial] = useState<Awaited<ReturnType<typeof fetchTrialBalance>> | null>(null)
  const [pl, setPl] = useState<Awaited<ReturnType<typeof fetchProfitLoss>> | null>(null)
  const [bs, setBs] = useState<Awaited<ReturnType<typeof fetchBalanceSheet>> | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      if (tab === 'trial') setTrial(await fetchTrialBalance(asOf))
      if (tab === 'pl') setPl(await fetchProfitLoss(from, to))
      if (tab === 'bs') setBs(await fetchBalanceSheet(asOf))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al generar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Reportes · {tenant.businessName}</title>
      </Head>
      <div className="space-y-6 px-4 py-8">
        <div>
          <Link href={SUITE_CONTABILIDAD_PATH} className="text-xs text-sky-300/80 hover:text-sky-200">
            ← Contabilidad
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Reportes</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['trial', 'Balanza'],
              ['pl', 'Estado de resultados'],
              ['bs', 'Balance general'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                tab === key
                  ? 'rounded-md bg-sky-500/20 px-3 py-1.5 text-sm font-semibold text-sky-100'
                  : 'rounded-md px-3 py-1.5 text-sm text-white/55 hover:bg-white/5'
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {tab === 'pl' ? (
            <>
              <label className="text-xs text-white/60">
                Desde
                <input
                  type="date"
                  className="mt-1 block input-glass px-3 py-2 text-sm"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-xs text-white/60">
                Hasta
                <input
                  type="date"
                  className="mt-1 block input-glass px-3 py-2 text-sm"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label className="text-xs text-white/60">
              Al
              <input
                type="date"
                className="mt-1 block input-glass px-3 py-2 text-sm"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </label>
          )}
          <Button type="button" disabled={busy} onClick={() => void run()}>
            Generar
          </Button>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {tab === 'trial' && trial ? (
          <div className="space-y-3">
            <p className="text-xs text-white/50">
              Totales {formatLempirasFromCents(trial.total_debit_cents)} /{' '}
              {formatLempirasFromCents(trial.total_credit_cents)} ·{' '}
              {trial.balanced ? 'Balanceada' : 'Desbalanceada'}
            </p>
            <ReportTable
              rows={(trial.rows as Array<{ code: string; name: string; debit_cents: number; credit_cents: number }>).map(
                (r) => ({
                  code: r.code,
                  name: r.name,
                  left: r.debit_cents,
                  right: r.credit_cents,
                })
              )}
              leftLabel="Débito"
              rightLabel="Crédito"
            />
          </div>
        ) : null}

        {tab === 'pl' && pl ? (
          <div className="space-y-4">
            <section>
              <h2 className="mb-2 text-sm font-semibold text-sky-100">Ingresos</h2>
              <ReportTable
                rows={(pl.revenue as Array<{ code: string; name: string; debit_cents: number; credit_cents: number }>).map(
                  (r) => ({
                    code: r.code,
                    name: r.name,
                    left: r.credit_cents - r.debit_cents,
                    right: 0,
                  })
                )}
                leftLabel="Saldo"
                rightLabel=""
                hideRight
              />
              <p className="mt-2 text-sm text-white/60">
                Total ingresos: {formatLempirasFromCents(pl.total_revenue_cents)}
              </p>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-sky-100">Gastos</h2>
              <ReportTable
                rows={(pl.expense as Array<{ code: string; name: string; debit_cents: number; credit_cents: number }>).map(
                  (r) => ({
                    code: r.code,
                    name: r.name,
                    left: r.debit_cents - r.credit_cents,
                    right: 0,
                  })
                )}
                leftLabel="Saldo"
                rightLabel=""
                hideRight
              />
              <p className="mt-2 text-sm text-white/60">
                Total gastos: {formatLempirasFromCents(pl.total_expense_cents)}
              </p>
            </section>
            <p className="text-sm font-semibold">
              Resultado: {formatLempirasFromCents(pl.net_income_cents)}
            </p>
          </div>
        ) : null}

        {tab === 'bs' && bs ? (
          <div className="space-y-4">
            <section>
              <h2 className="mb-2 text-sm font-semibold text-sky-100">Activos</h2>
              <ReportTable
                rows={(bs.assets as Array<{ code: string; name: string; debit_cents: number; credit_cents: number }>).map(
                  (r) => ({
                    code: r.code,
                    name: r.name,
                    left: r.debit_cents - r.credit_cents,
                    right: 0,
                  })
                )}
                leftLabel="Saldo"
                rightLabel=""
                hideRight
              />
              <p className="mt-2 text-sm">Total activos: {formatLempirasFromCents(bs.total_assets_cents)}</p>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-sky-100">Pasivos</h2>
              <ReportTable
                rows={(bs.liabilities as Array<{ code: string; name: string; debit_cents: number; credit_cents: number }>).map(
                  (r) => ({
                    code: r.code,
                    name: r.name,
                    left: r.credit_cents - r.debit_cents,
                    right: 0,
                  })
                )}
                leftLabel="Saldo"
                rightLabel=""
                hideRight
              />
              <p className="mt-2 text-sm">
                Total pasivos: {formatLempirasFromCents(bs.total_liabilities_cents)}
              </p>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-sky-100">Patrimonio</h2>
              <ReportTable
                rows={(bs.equity as Array<{ code: string; name: string; debit_cents: number; credit_cents: number }>).map(
                  (r) => ({
                    code: r.code,
                    name: r.name,
                    left: r.credit_cents - r.debit_cents,
                    right: 0,
                  })
                )}
                leftLabel="Saldo"
                rightLabel=""
                hideRight
              />
              <p className="mt-2 text-sm text-white/60">
                Resultado YTD (bridge): {formatLempirasFromCents(bs.net_income_ytd_cents)}
              </p>
              <p className="mt-1 text-sm">
                Total patrimonio: {formatLempirasFromCents(bs.total_equity_cents)}
              </p>
            </section>
            <p className="text-xs text-white/55">
              {bs.balanced ? 'Ecuación A = P + PN se cumple.' : 'Ecuación desbalanceada — revisar asientos.'}
            </p>
          </div>
        ) : null}
      </div>
    </SuiteShell>
  )
}

function ReportTable({
  rows,
  leftLabel,
  rightLabel,
  hideRight,
}: {
  rows: Array<{ code: string; name: string; left: number; right: number }>
  leftLabel: string
  rightLabel: string
  hideRight?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-white/55">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Cuenta</th>
            <th className="px-3 py-2 text-right">{leftLabel}</th>
            {!hideRight ? <th className="px-3 py-2 text-right">{rightLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={hideRight ? 3 : 4} className="px-3 py-4 text-center text-white/55">
                Sin movimientos en el rango.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.code} className="border-t border-white/5">
                <td className="px-3 py-2 font-mono text-sky-100/80">{row.code}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatLempirasFromCents(row.left)}
                </td>
                {!hideRight ? (
                  <td className="px-3 py-2 text-right font-mono">
                    {formatLempirasFromCents(row.right)}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
