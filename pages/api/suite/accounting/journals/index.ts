/**
 * Listar y crear asientos (draft atómico vía RPC).
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import { journalDraftSchema, journalListQuerySchema } from '../../../../../lib/suite/accounting/schemas'
import { requireSuiteApi } from '../../../../../lib/suite/tenant'

const ENTRIES_TABLE = 'accounting_journal_entries'

function mapUpsertError(message: string): { status: number; error: string } {
  if (message.includes('entry_needs_two_lines')) {
    return { status: 400, error: 'Se necesitan al menos dos líneas.' }
  }
  if (message.includes('line_xor_invalid')) {
    return { status: 400, error: 'Cada línea debe tener débito o crédito, no ambos.' }
  }
  if (message.includes('account_not_postable') || message.includes('account_not_found')) {
    return { status: 400, error: 'Cuenta inválida o no postable.' }
  }
  if (message.includes('not_allowed')) {
    return { status: 403, error: 'No autorizado.' }
  }
  return { status: 500, error: 'No se pudo crear el asiento' }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'contabilidad' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  const siteId = ctx.tenant.site.id

  try {
    if (req.method === 'GET') {
      const parsed = journalListQuerySchema.safeParse({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      })
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Filtros inválidos' })
      }

      let query = ctx.supabase
        .from(ENTRIES_TABLE)
        .select(
          '*, accounting_journal_lines(id, entry_id, site_id, account_id, line_no, debit_cents, credit_cents, memo, created_at)'
        )
        .eq('site_id', siteId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (parsed.data.status) query = query.eq('status', parsed.data.status)
      if (parsed.data.from) query = query.gte('entry_date', parsed.data.from)
      if (parsed.data.to) query = query.lte('entry_date', parsed.data.to)

      const { data, error } = await query
      if (error) {
        logger.error('Error listando asientos', { siteId, error: error.message })
        return res.status(500).json({ error: 'No se pudieron cargar los asientos' })
      }
      return res.status(200).json({ entries: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = journalDraftSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
      }

      const { data, error } = await ctx.supabase.rpc('accounting_upsert_draft_entry', {
        p_site_id: siteId,
        p_entry_date: parsed.data.entry_date,
        p_description: parsed.data.description,
        p_lines: parsed.data.lines.map((line) => ({
          account_id: line.account_id,
          debit_cents: line.debit_cents,
          credit_cents: line.credit_cents,
          memo: line.memo ?? null,
        })),
        p_entry_id: null,
      })

      if (error) {
        logger.error('Error creando asiento', { siteId, error: error.message })
        const mapped = mapUpsertError(error.message)
        return res.status(mapped.status).json({ error: mapped.error })
      }

      const entryId = (data as { id?: string } | null)?.id
      if (!entryId) return res.status(201).json({ entry: data })

      const { data: full } = await ctx.supabase
        .from(ENTRIES_TABLE)
        .select('*, accounting_journal_lines(*, accounting_accounts(code, name, account_type))')
        .eq('id', entryId)
        .eq('site_id', siteId)
        .single()

      return res.status(201).json({ entry: full ?? data })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en asientos'
    return res.status(500).json({ error: message })
  }
}
