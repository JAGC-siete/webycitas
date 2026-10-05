/**
 * Publicar asiento draft → posted (RPC balanceado).
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../../lib/logger'
import { requireSuiteApi } from '../../../../../../lib/suite/tenant'

const ENTRIES_TABLE = 'accounting_journal_entries'

function mapPostError(message: string): { status: number; error: string } {
  if (message.includes('entry_unbalanced')) {
    return { status: 400, error: 'Asiento desbalanceado: débitos deben igualar créditos.' }
  }
  if (message.includes('entry_needs_two_lines')) {
    return { status: 400, error: 'Se necesitan al menos dos líneas.' }
  }
  if (message.includes('entry_not_draft')) {
    return { status: 409, error: 'Solo se publican asientos en borrador.' }
  }
  if (message.includes('entry_not_found')) {
    return { status: 404, error: 'Asiento no encontrado.' }
  }
  if (message.includes('not_allowed')) {
    return { status: 403, error: 'No autorizado.' }
  }
  return { status: 500, error: 'No se pudo publicar el asiento' }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'contabilidad' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const siteId = ctx.tenant.site.id
  const id = typeof req.query.id === 'string' ? req.query.id : null
  if (!id) return res.status(400).json({ error: 'id requerido' })

  const { data: owned } = await ctx.supabase
    .from(ENTRIES_TABLE)
    .select('id')
    .eq('id', id)
    .eq('site_id', siteId)
    .maybeSingle()
  if (!owned) return res.status(404).json({ error: 'Asiento no encontrado' })

  const { data, error } = await ctx.supabase.rpc('accounting_post_journal_entry', {
    p_entry_id: id,
  })

  if (error) {
    logger.error('Error publicando asiento', { siteId, id, error: error.message })
    const mapped = mapPostError(error.message)
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
