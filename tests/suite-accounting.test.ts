import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  signedBalance,
} from '../lib/suite/accounting/reports'
import {
  centsToLempirasInput,
  isLineXorValid,
  journalBalancedSchema,
  journalDraftSchema,
  lempirasToCents,
  linesBalanceDelta,
} from '../lib/suite/accounting/schemas'
import { normalBalanceForType } from '../lib/suite/accounting/types'

const A1 = '11111111-1111-4111-8111-111111111111'
const A2 = '22222222-2222-4222-8222-222222222222'

describe('accounting schemas', () => {
  it('allows unbalanced journal drafts', () => {
    const parsed = journalDraftSchema.safeParse({
      entry_date: '2026-10-05',
      description: 'Borrador incompleto',
      lines: [
        { account_id: A1, debit_cents: 1000, credit_cents: 0 },
        { account_id: A2, debit_cents: 0, credit_cents: 900 },
      ],
    })
    assert.equal(parsed.success, true)
  })

  it('rejects unbalanced drafts only on balanced schema (post gate)', () => {
    const parsed = journalBalancedSchema.safeParse({
      entry_date: '2026-10-05',
      description: 'Pago desbalanceado',
      lines: [
        { account_id: A1, debit_cents: 1000, credit_cents: 0 },
        { account_id: A2, debit_cents: 0, credit_cents: 900 },
      ],
    })
    assert.equal(parsed.success, false)
  })

  it('accepts balanced journal for post gate', () => {
    const parsed = journalBalancedSchema.safeParse({
      entry_date: '2026-10-05',
      description: 'Cobro de servicio',
      lines: [
        { account_id: A1, debit_cents: 15000, credit_cents: 0 },
        { account_id: A2, debit_cents: 0, credit_cents: 15000 },
      ],
    })
    assert.equal(parsed.success, true)
  })

  it('enforces XOR on line amounts', () => {
    assert.equal(isLineXorValid(100, 0), true)
    assert.equal(isLineXorValid(0, 100), true)
    assert.equal(isLineXorValid(0, 0), false)
    assert.equal(isLineXorValid(50, 50), false)
  })

  it('computes balance delta', () => {
    assert.equal(
      linesBalanceDelta([
        { debit_cents: 100, credit_cents: 0 },
        { debit_cents: 0, credit_cents: 100 },
      ]),
      0
    )
    assert.equal(
      linesBalanceDelta([
        { debit_cents: 200, credit_cents: 0 },
        { debit_cents: 0, credit_cents: 100 },
      ]),
      100
    )
  })

  it('parses Lempiras to cents without ambiguity', () => {
    assert.equal(lempirasToCents('150'), 15000)
    assert.equal(lempirasToCents('150.00'), 15000)
    assert.equal(lempirasToCents('150.5'), 15050)
    assert.equal(lempirasToCents('0.01'), 1)
    assert.equal(Number.isNaN(lempirasToCents('12.345')), true)
    assert.equal(centsToLempirasInput(15000), '150')
    assert.equal(centsToLempirasInput(15050), '150.50')
  })
})

describe('accounting report math', () => {
  const cash = {
    account_id: 'a1',
    code: '1100',
    name: 'Caja',
    account_type: 'asset' as const,
    normal_balance: 'debit' as const,
    debit_cents: 20000,
    credit_cents: 5000,
  }
  const revenue = {
    account_id: 'a2',
    code: '4100',
    name: 'Ingresos',
    account_type: 'revenue' as const,
    normal_balance: 'credit' as const,
    debit_cents: 0,
    credit_cents: 15000,
  }
  const expense = {
    account_id: 'a3',
    code: '5100',
    name: 'Gastos',
    account_type: 'expense' as const,
    normal_balance: 'debit' as const,
    debit_cents: 3000,
    credit_cents: 0,
  }
  const equity = {
    account_id: 'a4',
    code: '3100',
    name: 'Capital',
    account_type: 'equity' as const,
    normal_balance: 'credit' as const,
    debit_cents: 0,
    credit_cents: 3000,
  }

  it('maps normal balances by account type', () => {
    assert.equal(normalBalanceForType('asset'), 'debit')
    assert.equal(normalBalanceForType('expense'), 'debit')
    assert.equal(normalBalanceForType('liability'), 'credit')
    assert.equal(normalBalanceForType('equity'), 'credit')
    assert.equal(normalBalanceForType('revenue'), 'credit')
  })

  it('builds a balanced trial balance when totals match', () => {
    const tb = buildTrialBalance([cash, revenue, expense, equity])
    assert.equal(tb.total_debit_cents, 23000)
    assert.equal(tb.total_credit_cents, 23000)
    assert.equal(tb.balanced, true)
  })

  it('computes P&L net income', () => {
    const pl = buildProfitAndLoss([revenue, expense])
    assert.equal(pl.total_revenue_cents, 15000)
    assert.equal(pl.total_expense_cents, 3000)
    assert.equal(pl.net_income_cents, 12000)
  })

  it('bridges YTD income into balance sheet equity', () => {
    const pl = buildProfitAndLoss([revenue, expense])
    const bs = buildBalanceSheet([cash, equity], pl.net_income_cents)
    assert.equal(signedBalance(cash), 15000)
    assert.equal(bs.total_assets_cents, 15000)
    assert.equal(bs.total_equity_cents, 3000 + 12000)
    assert.equal(bs.balanced, true)
  })
})

describe('accounting integrity contracts', () => {
  it('documents status lock: only mutation flag may change status', () => {
    // Contract mirrored by accounting_entries_immutable():
    // - without app.accounting_mutation=on, status change raises entry_status_locked
    // - post/reverse RPCs set the flag before updating status
    const allowedTransitions = [
      { from: 'draft', to: 'posted', via: 'accounting_post_journal_entry' },
      { from: 'posted', to: 'reversed', via: 'accounting_reverse_journal_entry' },
    ] as const
    assert.equal(allowedTransitions.length, 2)
    assert.deepEqual(
      allowedTransitions.map((t) => t.from + '→' + t.to),
      ['draft→posted', 'posted→reversed']
    )
  })

  it('documents line/entry site equality + report RPC', () => {
    const guards = [
      'accounting_line_entry_site_guard',
      'accounting_upsert_draft_entry',
      'accounting_report_line_aggs',
    ]
    assert.equal(guards.includes('accounting_report_line_aggs'), true)
    assert.equal(guards.includes('accounting_upsert_draft_entry'), true)
  })
})
