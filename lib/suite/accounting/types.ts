/** Tipos del módulo Contabilidad (mirror de enums Postgres). */

export const ACCOUNTING_ACCOUNT_TYPES = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
] as const
export type AccountingAccountType = (typeof ACCOUNTING_ACCOUNT_TYPES)[number]

export const ACCOUNTING_NORMAL_BALANCES = ['debit', 'credit'] as const
export type AccountingNormalBalance = (typeof ACCOUNTING_NORMAL_BALANCES)[number]

export const ACCOUNTING_ENTRY_STATUSES = ['draft', 'posted', 'reversed'] as const
export type AccountingEntryStatus = (typeof ACCOUNTING_ENTRY_STATUSES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountingAccountType, string> = {
  asset: 'Activo',
  liability: 'Pasivo',
  equity: 'Patrimonio',
  revenue: 'Ingreso',
  expense: 'Gasto',
}

export const ENTRY_STATUS_LABELS: Record<AccountingEntryStatus, string> = {
  draft: 'Borrador',
  posted: 'Publicado',
  reversed: 'Reversado',
}

export function normalBalanceForType(type: AccountingAccountType): AccountingNormalBalance {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit'
}

export interface AccountingAccount {
  id: string
  site_id: string
  code: string
  name: string
  account_type: AccountingAccountType
  normal_balance: AccountingNormalBalance
  parent_id: string | null
  is_postable: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AccountingJournalLine {
  id: string
  entry_id: string
  site_id: string
  account_id: string
  line_no: number
  debit_cents: number
  credit_cents: number
  memo: string | null
  created_at: string
  accounting_accounts?: Pick<AccountingAccount, 'code' | 'name' | 'account_type'> | null
}

export interface AccountingJournalEntry {
  id: string
  site_id: string
  entry_date: string
  description: string
  status: AccountingEntryStatus
  source: string
  reverses_entry_id: string | null
  posted_at: string | null
  posted_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  accounting_journal_lines?: AccountingJournalLine[]
}
