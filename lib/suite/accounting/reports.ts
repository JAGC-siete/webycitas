/**
 * Agregaciones de reportes contables sobre líneas posted.
 * Los asientos reversed quedan neteados por su asiento de reverso (también posted).
 */

import type { AccountingAccountType, AccountingNormalBalance } from './types'

export interface ReportAccountRow {
  account_id: string
  code: string
  name: string
  account_type: AccountingAccountType
  normal_balance: AccountingNormalBalance
  debit_cents: number
  credit_cents: number
}

export interface PostedLineAgg {
  account_id: string
  code: string
  name: string
  account_type: AccountingAccountType
  normal_balance: AccountingNormalBalance
  debit_cents: number
  credit_cents: number
}

export function signedBalance(row: {
  debit_cents: number
  credit_cents: number
  normal_balance: AccountingNormalBalance
}): number {
  if (row.normal_balance === 'debit') {
    return row.debit_cents - row.credit_cents
  }
  return row.credit_cents - row.debit_cents
}

export function buildTrialBalance(rows: PostedLineAgg[]): {
  rows: ReportAccountRow[]
  total_debit_cents: number
  total_credit_cents: number
  balanced: boolean
} {
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code))
  const total_debit_cents = sorted.reduce((sum, row) => sum + row.debit_cents, 0)
  const total_credit_cents = sorted.reduce((sum, row) => sum + row.credit_cents, 0)
  return {
    rows: sorted,
    total_debit_cents,
    total_credit_cents,
    balanced: total_debit_cents === total_credit_cents,
  }
}

export function buildProfitAndLoss(rows: PostedLineAgg[]): {
  revenue: ReportAccountRow[]
  expense: ReportAccountRow[]
  total_revenue_cents: number
  total_expense_cents: number
  net_income_cents: number
} {
  const revenue = rows
    .filter((row) => row.account_type === 'revenue')
    .map((row) => ({ ...row }))
    .sort((a, b) => a.code.localeCompare(b.code))
  const expense = rows
    .filter((row) => row.account_type === 'expense')
    .map((row) => ({ ...row }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const total_revenue_cents = revenue.reduce((sum, row) => sum + signedBalance(row), 0)
  const total_expense_cents = expense.reduce((sum, row) => sum + signedBalance(row), 0)

  return {
    revenue,
    expense,
    total_revenue_cents,
    total_expense_cents,
    net_income_cents: total_revenue_cents - total_expense_cents,
  }
}

export function buildBalanceSheet(
  rows: PostedLineAgg[],
  netIncomeYtdCents: number
): {
  assets: ReportAccountRow[]
  liabilities: ReportAccountRow[]
  equity: ReportAccountRow[]
  total_assets_cents: number
  total_liabilities_cents: number
  total_equity_cents: number
  net_income_ytd_cents: number
  balanced: boolean
} {
  const assets = rows
    .filter((row) => row.account_type === 'asset')
    .sort((a, b) => a.code.localeCompare(b.code))
  const liabilities = rows
    .filter((row) => row.account_type === 'liability')
    .sort((a, b) => a.code.localeCompare(b.code))
  const equity = rows
    .filter((row) => row.account_type === 'equity')
    .sort((a, b) => a.code.localeCompare(b.code))

  const total_assets_cents = assets.reduce((sum, row) => sum + signedBalance(row), 0)
  const total_liabilities_cents = liabilities.reduce((sum, row) => sum + signedBalance(row), 0)
  const equity_posted_cents = equity.reduce((sum, row) => sum + signedBalance(row), 0)
  const total_equity_cents = equity_posted_cents + netIncomeYtdCents

  return {
    assets,
    liabilities,
    equity,
    total_assets_cents,
    total_liabilities_cents,
    total_equity_cents,
    net_income_ytd_cents: netIncomeYtdCents,
    balanced: total_assets_cents === total_liabilities_cents + total_equity_cents,
  }
}

/** Agrupa líneas crudas por cuenta. */
export function aggregatePostedLines(
  lines: Array<{
    account_id: string
    debit_cents: number
    credit_cents: number
    accounting_accounts: {
      code: string
      name: string
      account_type: AccountingAccountType
      normal_balance: AccountingNormalBalance
    } | null
  }>
): PostedLineAgg[] {
  const map = new Map<string, PostedLineAgg>()
  for (const line of lines) {
    const account = line.accounting_accounts
    if (!account) continue
    const existing = map.get(line.account_id)
    if (existing) {
      existing.debit_cents += line.debit_cents
      existing.credit_cents += line.credit_cents
      continue
    }
    map.set(line.account_id, {
      account_id: line.account_id,
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      normal_balance: account.normal_balance,
      debit_cents: line.debit_cents,
      credit_cents: line.credit_cents,
    })
  }
  return [...map.values()]
}
