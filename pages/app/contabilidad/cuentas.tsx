/**
 * Plan de cuentas: árbol + alta + seed plantilla.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../components/suite/SuiteShell'
import { Button } from '../../../components/ui/button'
import {
  createAccountingAccount,
  fetchAccountingAccounts,
  seedAccountingCoa,
  updateAccountingAccount,
} from '../../../lib/suite/accounting-api'
import {
  ACCOUNTING_ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type AccountingAccount,
  type AccountingAccountType,
} from '../../../lib/suite/accounting/types'
import { SUITE_CONTABILIDAD_PATH } from '../../../lib/suite/paths'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'contabilidad' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function ContabilidadCuentasPage({ tenant }: { tenant: SuiteTenant }) {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    account_type: 'asset' as AccountingAccountType,
    parent_id: '',
    is_postable: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAccountingAccounts()
      setAccounts(data.accounts)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const parents = useMemo(
    () => accounts.filter((a) => !a.is_postable && a.is_active),
    [accounts]
  )

  async function onSeed() {
    setBusy(true)
    try {
      const result = await seedAccountingCoa()
      setAccounts(result.accounts)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la plantilla')
    } finally {
      setBusy(false)
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await createAccountingAccount({
        code: form.code,
        name: form.name,
        account_type: form.account_type,
        parent_id: form.parent_id || null,
        is_postable: form.is_postable,
        is_active: true,
      })
      setForm({ code: '', name: '', account_type: 'asset', parent_id: '', is_postable: true })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(account: AccountingAccount) {
    setBusy(true)
    try {
      await updateAccountingAccount(account.id, { is_active: !account.is_active })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Plan de cuentas · {tenant.businessName}</title>
      </Head>
      <div className="space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href={SUITE_CONTABILIDAD_PATH} className="text-xs text-sky-300/80 hover:text-sky-200">
              ← Contabilidad
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">Plan de cuentas</h1>
          </div>
          <Button type="button" disabled={busy} onClick={() => void onSeed()}>
            Cargar plantilla
          </Button>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {loading ? <p className="text-sm text-white/50">Cargando…</p> : null}

        <form
          onSubmit={(e) => void onCreate(e)}
          className="grid gap-3 rounded-lg border border-white/10 bg-slate-900/50 p-4 sm:grid-cols-2"
        >
          <label className="text-xs text-white/60">
            Código
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-white/60">
            Nombre
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-white/60">
            Tipo
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={form.account_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, account_type: e.target.value as AccountingAccountType }))
              }
            >
              {ACCOUNTING_ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/60">
            Padre (opcional)
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={form.parent_id}
              onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
            >
              <option value="">— Sin padre —</option>
              {parents
                .filter((p) => p.account_type === form.account_type)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-white/60 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_postable}
              onChange={(e) => setForm((f) => ({ ...f, is_postable: e.target.checked }))}
            />
            Cuenta postable (recibe asientos)
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Agregar cuenta
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Postable</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-sky-100/90">{account.code}</td>
                  <td className="px-3 py-2">{account.name}</td>
                  <td className="px-3 py-2 text-white/60">
                    {ACCOUNT_TYPE_LABELS[account.account_type]}
                  </td>
                  <td className="px-3 py-2 text-white/60">{account.is_postable ? 'Sí' : 'No'}</td>
                  <td className="px-3 py-2 text-white/60">
                    {account.is_active ? 'Activa' : 'Inactiva'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-sky-300 hover:text-sky-100"
                      disabled={busy}
                      onClick={() => void toggleActive(account)}
                    >
                      {account.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-white/45">
                    Sin cuentas. Carga la plantilla para empezar.
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
