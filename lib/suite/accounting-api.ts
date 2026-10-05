/**
 * Cliente del panel owner para /api/suite/accounting.
 */

import { suiteFetch } from '../auth/client-session'
import {
  SUITE_ACCOUNTING_ACCOUNTS_API,
  SUITE_ACCOUNTING_BALANCE_SHEET_API,
  SUITE_ACCOUNTING_JOURNALS_API,
  SUITE_ACCOUNTING_PROFIT_LOSS_API,
  SUITE_ACCOUNTING_TRIAL_BALANCE_API,
  suiteAccountingAccountApi,
  suiteAccountingJournalApi,
  suiteAccountingJournalPostApi,
  suiteAccountingJournalReverseApi,
} from './paths'
import type { JournalDraftInput, UpdateAccountInput } from './accounting/schemas'
import type { AccountingAccountType } from './accounting/types'
import type { AccountingAccount, AccountingJournalEntry } from './accounting/types'

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error || fallback
}

export async function fetchAccountingAccounts(): Promise<{ accounts: AccountingAccount[] }> {
  const res = await suiteFetch(SUITE_ACCOUNTING_ACCOUNTS_API)
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar el plan de cuentas'))
  return (await res.json()) as { accounts: AccountingAccount[] }
}

export async function seedAccountingCoa(): Promise<{ inserted: number; accounts: AccountingAccount[] }> {
  const res = await suiteFetch(SUITE_ACCOUNTING_ACCOUNTS_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'seed' }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar la plantilla'))
  return (await res.json()) as { inserted: number; accounts: AccountingAccount[] }
}

export async function createAccountingAccount(input: {
  code: string
  name: string
  account_type: AccountingAccountType
  parent_id?: string | null
  is_postable?: boolean
  is_active?: boolean
}): Promise<{ account: AccountingAccount }> {
  const res = await suiteFetch(SUITE_ACCOUNTING_ACCOUNTS_API, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo crear la cuenta'))
  return (await res.json()) as { account: AccountingAccount }
}

export async function updateAccountingAccount(
  accountId: string,
  input: UpdateAccountInput
): Promise<{ account: AccountingAccount }> {
  const res = await suiteFetch(suiteAccountingAccountApi(accountId), {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo actualizar la cuenta'))
  return (await res.json()) as { account: AccountingAccount }
}

export async function fetchAccountingJournals(query?: {
  status?: string
  from?: string
  to?: string
}): Promise<{ entries: AccountingJournalEntry[] }> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.from) params.set('from', query.from)
  if (query?.to) params.set('to', query.to)
  const qs = params.toString()
  const res = await suiteFetch(`${SUITE_ACCOUNTING_JOURNALS_API}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron cargar los asientos'))
  return (await res.json()) as { entries: AccountingJournalEntry[] }
}

export async function fetchAccountingJournal(
  entryId: string
): Promise<{ entry: AccountingJournalEntry }> {
  const res = await suiteFetch(suiteAccountingJournalApi(entryId))
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar el asiento'))
  return (await res.json()) as { entry: AccountingJournalEntry }
}

export async function createAccountingJournal(
  input: JournalDraftInput
): Promise<{ entry: AccountingJournalEntry }> {
  const res = await suiteFetch(SUITE_ACCOUNTING_JOURNALS_API, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo crear el asiento'))
  return (await res.json()) as { entry: AccountingJournalEntry }
}

export async function updateAccountingJournal(
  entryId: string,
  input: JournalDraftInput
): Promise<{ entry: AccountingJournalEntry }> {
  const res = await suiteFetch(suiteAccountingJournalApi(entryId), {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar el asiento'))
  return (await res.json()) as { entry: AccountingJournalEntry }
}

export async function deleteAccountingJournal(entryId: string): Promise<{ success: true }> {
  const res = await suiteFetch(suiteAccountingJournalApi(entryId), { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo borrar el asiento'))
  return (await res.json()) as { success: true }
}

export async function postAccountingJournal(
  entryId: string
): Promise<{ entry: AccountingJournalEntry }> {
  const res = await suiteFetch(suiteAccountingJournalPostApi(entryId), { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo publicar el asiento'))
  return (await res.json()) as { entry: AccountingJournalEntry }
}

export async function reverseAccountingJournal(
  entryId: string,
  input?: { entry_date?: string; description?: string }
): Promise<{ entry: AccountingJournalEntry }> {
  const res = await suiteFetch(suiteAccountingJournalReverseApi(entryId), {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo reversar el asiento'))
  return (await res.json()) as { entry: AccountingJournalEntry }
}

export async function fetchTrialBalance(asOf: string) {
  const res = await suiteFetch(`${SUITE_ACCOUNTING_TRIAL_BALANCE_API}?as_of=${encodeURIComponent(asOf)}`)
  if (!res.ok) throw new Error(await readError(res, 'No se pudo generar la balanza'))
  return await res.json()
}

export async function fetchProfitLoss(from: string, to: string) {
  const res = await suiteFetch(
    `${SUITE_ACCOUNTING_PROFIT_LOSS_API}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  )
  if (!res.ok) throw new Error(await readError(res, 'No se pudo generar el estado de resultados'))
  return await res.json()
}

export async function fetchBalanceSheet(asOf: string) {
  const res = await suiteFetch(
    `${SUITE_ACCOUNTING_BALANCE_SHEET_API}?as_of=${encodeURIComponent(asOf)}`
  )
  if (!res.ok) throw new Error(await readError(res, 'No se pudo generar el balance general'))
  return await res.json()
}
