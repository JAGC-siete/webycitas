/**
 * Detalle / actualizar / borrar asiento draft (replace atómico vía RPC).
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import { journalDraftSchema } from '../../../../../lib/suite/accounting/schemas'
import { requireSuiteApi } from '../../../../../lib/suite/tenant'

const ENTRIES_TABLE = 'accounting_journal_entries'

function mapUpsertError(message: string): { status: number; error: string } {
  if (message.includes('entry_not_draft')) {
    return { status: 409, error: 'Solo se editan asientos en borrador' }
  }
  if (message.includes('entry_not_found')) {
    return { status: 404, error: 'Asiento no encontrado' }
  }
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
  return { status: 500, error: 'No se pudo guardar el asiento' }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'contabilidad' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  const siteId = ctx.tenant.site.id
  const id = typeof req.query.id === 'string' ? req.query.id : null
  if (!id) return res.status(400).json({ error: 'id requerido' })

  try {
    if (req.method === 'GET') {
      const { data, error } = await ctx.supabase
        .from(ENTRIES_TABLE)
        .select('*, accounting_journal_lines(*, accounting_accounts(code, name, account_type))')
        .eq('id', id)
        .eq('site_id', siteId)
        .maybeSingle()

      if (error) {
        logger.error('Error leyendo asiento', { siteId, id, error: error.message })
        return res.status(500).json({ error: 'No se pudo cargar el asiento' })
      }
      if (!data) return res.status(404).json({ error: 'Asiento no encontrado' })
      return res.status(200).json({ entry: data })
    }

    if (req.method === 'PATCH') {
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
        p_entry_id: id,
      })

      if (error) {
        logger.error('Error actualizando asiento', { siteId, id, error: error.message })
        const mapped = mapUpsertError(error.message)
        return res.status(mapped.status).json({ error: mapped.error })
      }

      const { data: full } = await ctx.supabase
        .from(ENTRIES_TABLE)
        .select('*, accounting_journal_lines(*, accounting_accounts(code, name, account_type))')
        .eq('id', id)
        .eq('site_id', siteId)
        .single()

      return res.status(200).json({ entry: full ?? data })
    }

    if (req.method === 'DELETE') {
      const { data: existing } = await ctx.supabase
        .from(ENTRIES_TABLE)
        .select('id, status')
        .eq('id', id)
        .eq('site_id', siteId)
        .maybeSingle()

      if (!existing) return res.status(404).json({ error: 'Asiento no encontrado' })
      if (existing.status !== 'draft') {
        return res.status(409).json({ error: 'Solo se borran asientos en borrador' })
      }

      const { error } = await ctx.supabase
        .from(ENTRIES_TABLE)
        .delete()
        .eq('id', id)
        .eq('site_id', siteId)

      if (error) {
        logger.error('Error borrando asiento', { siteId, id, error: error.message })
        return res.status(500).json({ error: 'No se pudo borrar el asiento' })
      }
      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en asiento'
    return res.status(500).json({ error: message })
  }
}
