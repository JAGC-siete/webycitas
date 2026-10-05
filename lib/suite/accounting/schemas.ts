import { z } from 'zod'
import { ACCOUNTING_ACCOUNT_TYPES, ACCOUNTING_ENTRY_STATUSES, normalBalanceForType } from './types'

export const createAccountSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    name: z.string().trim().min(1).max(120),
    account_type: z.enum(ACCOUNTING_ACCOUNT_TYPES),
    parent_id: z.string().uuid().nullable().optional(),
    is_postable: z.boolean().default(true),
    is_active: z.boolean().default(true),
  })
  .transform((value) => ({
    ...value,
    parent_id: value.parent_id ?? null,
    normal_balance: normalBalanceForType(value.account_type),
  }))

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  is_active: z.boolean().optional(),
  is_postable: z.boolean().optional(),
  parent_id: z.string().uuid().nullable().optional(),
})

export const journalLineInputSchema = z
  .object({
    account_id: z.string().uuid(),
    debit_cents: z.number().int().min(0).max(999_999_999_999).default(0),
    credit_cents: z.number().int().min(0).max(999_999_999_999).default(0),
    memo: z.string().trim().min(1).max(240).nullable().optional(),
  })
  .superRefine((line, ctx) => {
    const debit = line.debit_cents > 0
    const credit = line.credit_cents > 0
    if (debit === credit) {
      ctx.addIssue({
        code: 'custom',
        message: 'Cada línea debe tener débito o crédito, no ambos ni ninguno.',
      })
    }
  })

/** Draft libre: XOR por línea y ≥2 líneas; el balance solo se exige al publicar. */
export const journalDraftSchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  description: z.string().trim().min(1).max(500),
  lines: z.array(journalLineInputSchema).min(2, 'Se necesitan al menos dos líneas'),
})

/** Validación previa a post / tests de balance. */
export const journalBalancedSchema = journalDraftSchema.superRefine((entry, ctx) => {
  const debits = entry.lines.reduce((sum, line) => sum + line.debit_cents, 0)
  const credits = entry.lines.reduce((sum, line) => sum + line.credit_cents, 0)
  if (debits !== credits) {
    ctx.addIssue({
      code: 'custom',
      message: `Asiento desbalanceado: débitos ${debits} ≠ créditos ${credits}`,
      path: ['lines'],
    })
  }
  if (debits === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'El asiento debe tener montos mayores a cero',
      path: ['lines'],
    })
  }
})

export const journalListQuerySchema = z.object({
  status: z.enum(ACCOUNTING_ENTRY_STATUSES).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const reverseJournalSchema = z.object({
  entry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().trim().min(1).max(500).optional(),
})

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const profitLossQuerySchema = z.object({
  from: dateOnlySchema,
  to: dateOnlySchema,
})

export type CreateAccountInput = z.output<typeof createAccountSchema>
export type UpdateAccountInput = z.output<typeof updateAccountSchema>
export type JournalDraftInput = z.output<typeof journalDraftSchema>

/** Helpers puros para tests / UI (sin Zod). */
export function linesBalanceDelta(
  lines: ReadonlyArray<{ debit_cents: number; credit_cents: number }>
): number {
  const debits = lines.reduce((sum, line) => sum + line.debit_cents, 0)
  const credits = lines.reduce((sum, line) => sum + line.credit_cents, 0)
  return debits - credits
}

export function isLineXorValid(debit_cents: number, credit_cents: number): boolean {
  return (debit_cents > 0 && credit_cents === 0) || (credit_cents > 0 && debit_cents === 0)
}

/** Parse Lempiras (ej. "150" o "150.50") → integer cents. */
export function lempirasToCents(raw: string): number {
  const trimmed = raw.trim().replace(/,/g, '')
  if (!trimmed) return 0
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return NaN
  const [whole, frac = ''] = trimmed.split('.')
  const cents = (frac + '00').slice(0, 2)
  return Number(whole) * 100 + Number(cents)
}

/** Format cents → editable Lempiras string without currency symbol. */
export function centsToLempirasInput(cents: number): string {
  if (!cents) return ''
  const neg = cents < 0
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  const body = frac === '00' ? String(whole) : `${whole}.${frac}`
  return neg ? `-${body}` : body
}
