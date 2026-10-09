/**
 * Editor de asiento: nuevo draft, editar draft, publicar, reversar.
 * Montos en Lempiras (UI) → cents (storage). Draft puede quedar desbalanceado.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../../components/suite/SuiteShell'
import { Button } from '../../../../components/ui/button'
import {
  createAccountingJournal,
  deleteAccountingJournal,
  fetchAccountingAccounts,
  fetchAccountingJournal,
  postAccountingJournal,
  reverseAccountingJournal,
  updateAccountingJournal,
} from '../../../../lib/suite/accounting-api'
import {
  centsToLempirasInput,
  lempirasToCents,
  linesBalanceDelta,
} from '../../../../lib/suite/accounting/schemas'
import {
  ENTRY_STATUS_LABELS,
  type AccountingAccount,
  type AccountingJournalEntry,
} from '../../../../lib/suite/accounting/types'
import { formatLempirasFromCents, hondurasTodayDate } from '../../../../lib/suite/schemas'
import { SUITE_CONTABILIDAD_ASIENTOS_PATH } from '../../../../lib/suite/paths'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../../lib/suite/tenant'

type LineDraft = {
  account_id: string
  debit: string
  credit: string
  memo: string
}

function emptyLine(): LineDraft {
  return { account_id: '', debit: '', credit: '', memo: '' }
}

function canSaveDraft(lines: Array<{ account_id: string; debit_cents: number; credit_cents: number }>) {
  if (lines.length < 2) return false
  if (lines.some((l) => !l.account_id || Number.isNaN(l.debit_cents) || Number.isNaN(l.credit_cents))) {
    return false
  }
  return lines.every((l) => (l.debit_cents > 0) !== (l.credit_cents > 0))
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'contabilidad' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function ContabilidadAsientoEditorPage({ tenant }: { tenant: SuiteTenant }) {
  const router = useRouter()
  const idParam = typeof router.query.id === 'string' ? router.query.id : ''
  const isNew = idParam === 'nuevo'

  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [entry, setEntry] = useState<AccountingJournalEntry | null>(null)
  const [entryDate, setEntryDate] = useState(hondurasTodayDate())
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()])
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const postable = useMemo(
    () => accounts.filter((a) => a.is_postable && a.is_active),
    [accounts]
  )

  const parsedLines = useMemo(() => {
    return lines.map((line) => ({
      account_id: line.account_id,
      debit_cents: lempirasToCents(line.debit),
      credit_cents: lempirasToCents(line.credit),
      memo: line.memo.trim() || null,
    }))
  }, [lines])

  const delta = useMemo(() => {
    if (parsedLines.some((l) => Number.isNaN(l.debit_cents) || Number.isNaN(l.credit_cents))) {
      return null
    }
    return linesBalanceDelta(parsedLines)
  }, [parsedLines])

  const draftOk = canSaveDraft(parsedLines)
  const postOk = draftOk && delta === 0

  const load = useCallback(async () => {
    try {
      const acct = await fetchAccountingAccounts()
      setAccounts(acct.accounts)
      if (!isNew && idParam) {
        const data = await fetchAccountingJournal(idParam)
        setEntry(data.entry)
        setEntryDate(data.entry.entry_date)
        setDescription(data.entry.description)
        const existing = (data.entry.accounting_journal_lines ?? [])
          .slice()
          .sort((a, b) => a.line_no - b.line_no)
          .map((line) => ({
            account_id: line.account_id,
            debit: centsToLempirasInput(line.debit_cents),
            credit: centsToLempirasInput(line.credit_cents),
            memo: line.memo ?? '',
          }))
        setLines(existing.length >= 2 ? existing : [emptyLine(), emptyLine()])
      }
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [idParam, isNew])

  useEffect(() => {
    if (!router.isReady) return
    void load()
  }, [router.isReady, load])

  const readOnly = entry ? entry.status !== 'draft' : false

  async function onSave() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        entry_date: entryDate,
        description,
        lines: parsedLines.map((line) => ({
          account_id: line.account_id,
          debit_cents: line.debit_cents,
          credit_cents: line.credit_cents,
          memo: line.memo,
        })),
      }
      if (isNew) {
        const created = await createAccountingJournal(payload)
        await router.replace(`${SUITE_CONTABILIDAD_ASIENTOS_PATH}/${created.entry.id}`)
        return
      }
      const updated = await updateAccountingJournal(idParam, payload)
      setEntry(updated.entry)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  async function onPost() {
    if (!idParam || isNew) return
    setBusy(true)
    try {
      const posted = await postAccountingJournal(idParam)
      setEntry(posted.entry)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar')
    } finally {
      setBusy(false)
    }
  }

  async function onReverse() {
    if (!idParam || isNew) return
    setBusy(true)
    try {
      const reversed = await reverseAccountingJournal(idParam)
      await router.push(`${SUITE_CONTABILIDAD_ASIENTOS_PATH}/${reversed.entry.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo reversar')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!idParam || isNew) return
    setBusy(true)
    try {
      await deleteAccountingJournal(idParam)
      await router.push(SUITE_CONTABILIDAD_ASIENTOS_PATH)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>
          {isNew ? 'Nuevo asiento' : 'Asiento'} · {tenant.businessName}
        </title>
      </Head>
      <div className="space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href={SUITE_CONTABILIDAD_ASIENTOS_PATH}
              className="text-xs text-sky-300/80 hover:text-sky-200"
            >
              ← Asientos
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">
              {isNew ? 'Nuevo asiento' : entry?.description || 'Asiento'}
            </h1>
            {entry ? (
              <p className="mt-1 text-xs text-white/50">{ENTRY_STATUS_LABELS[entry.status]}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!readOnly ? (
              <>
                <Button type="button" disabled={busy || !draftOk} onClick={() => void onSave()}>
                  Guardar borrador
                </Button>
                {!isNew ? (
                  <Button type="button" disabled={busy || !postOk} onClick={() => void onPost()}>
                    Publicar
                  </Button>
                ) : null}
                {!isNew ? (
                  <button
                    type="button"
                    className="rounded-md px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                    disabled={busy}
                    onClick={() => void onDelete()}
                  >
                    Borrar
                  </button>
                ) : null}
              </>
            ) : null}
            {entry?.status === 'posted' ? (
              <Button type="button" disabled={busy} onClick={() => void onReverse()}>
                Reversar
              </Button>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {loading ? <p className="text-sm text-white/50">Cargando…</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-white/60">
            Fecha
            <input
              type="date"
              className="mt-1 w-full input-glass px-3 py-2 text-sm"
              value={entryDate}
              disabled={readOnly}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-white/60 sm:col-span-2">
            Glosa
            <input
              className="mt-1 w-full input-glass px-3 py-2 text-sm"
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-white/55">
              <tr>
                <th className="px-3 py-2">Cuenta</th>
                <th className="px-3 py-2 text-right">Débito (L.)</th>
                <th className="px-3 py-2 text-right">Crédito (L.)</th>
                <th className="px-3 py-2">Memo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <select
                      className="w-full input-glass px-2 py-1.5 text-sm"
                      value={line.account_id}
                      disabled={readOnly}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, account_id: e.target.value } : item
                          )
                        )
                      }
                    >
                      <option value="">—</option>
                      {postable.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full input-glass px-2 py-1.5 text-right font-mono text-sm"
                      value={line.debit}
                      disabled={readOnly}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, debit: e.target.value, credit: '' } : item
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full input-glass px-2 py-1.5 text-right font-mono text-sm"
                      value={line.credit}
                      disabled={readOnly}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, credit: e.target.value, debit: '' } : item
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full input-glass px-2 py-1.5 text-sm"
                      value={line.memo}
                      disabled={readOnly}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, memo: e.target.value } : item
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!readOnly && lines.length > 2 ? (
                      <button
                        type="button"
                        className="text-xs text-white/55 hover:text-white/70"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!readOnly ? (
          <button
            type="button"
            className="text-sm text-sky-300 hover:text-sky-100"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            + Línea
          </button>
        ) : null}

        <p className="text-sm text-white/55">
          Δ ={' '}
          <span className={delta === 0 ? 'text-emerald-300' : 'text-amber-300'}>
            {delta === null
              ? '—'
              : formatLempirasFromCents(Math.abs(delta)) +
                (delta === 0 ? ' (balanceado)' : ' (solo se publica si Δ = 0)')}
          </span>
        </p>
      </div>
    </SuiteShell>
  )
}
