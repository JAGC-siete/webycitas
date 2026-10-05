/**
 * Helpers compartidos para reportes: agregación SQL vía RPC.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  type PostedLineAgg,
} from './reports'
import type { AccountingAccountType, AccountingNormalBalance } from './types'

type AggRow = {
  account_id: string
  code: string
  name: string
  account_type: AccountingAccountType
  normal_balance: AccountingNormalBalance
  debit_cents: number | string
  credit_cents: number | string
}

export async function loadPostedLineAggs(
  supabase: SupabaseClient,
  siteId: string,
  opts: { asOf?: string; from?: string; to?: string; types?: AccountingAccountType[] }
): Promise<{ rows: PostedLineAgg[]; error: string | null }> {
  const { data, error } = await supabase.rpc('accounting_report_line_aggs', {
    p_site_id: siteId,
    p_as_of: opts.asOf ?? null,
    p_from: opts.from ?? null,
    p_to: opts.to ?? null,
    p_types: opts.types ?? null,
  })

  if (error) return { rows: [], error: error.message }

  const rows: PostedLineAgg[] = ((data ?? []) as AggRow[]).map((row) => ({
    account_id: row.account_id,
    code: row.code,
    name: row.name,
    account_type: row.account_type,
    normal_balance: row.normal_balance,
    debit_cents: Number(row.debit_cents),
    credit_cents: Number(row.credit_cents),
  }))

  return { rows, error: null }
}

export { buildBalanceSheet, buildProfitAndLoss, buildTrialBalance }
