/**
 * Actualizar metadata de una cuenta del plan.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import { updateAccountSchema } from '../../../../../lib/suite/accounting/schemas'
import { requireSuiteApi } from '../../../../../lib/suite/tenant'

const ACCOUNTS_TABLE = 'accounting_accounts'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'contabilidad' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  const siteId = ctx.tenant.site.id
  const id = typeof req.query.id === 'string' ? req.query.id : null
  if (!id) return res.status(400).json({ error: 'id requerido' })

  try {
    if (req.method === 'PATCH') {
      const parsed = updateAccountSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
      }

      const patch: Record<string, unknown> = {}
      if (parsed.data.name !== undefined) patch.name = parsed.data.name
      if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active
      if (parsed.data.is_postable !== undefined) patch.is_postable = parsed.data.is_postable
      if (parsed.data.parent_id !== undefined) patch.parent_id = parsed.data.parent_id

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'Nada que actualizar' })
      }

      const { data, error } = await ctx.supabase
        .from(ACCOUNTS_TABLE)
        .update(patch)
        .eq('id', id)
        .eq('site_id', siteId)
        .select('*')
        .single()

      if (error) {
        logger.error('Error actualizando cuenta', { siteId, id, error: error.message })
        return res.status(500).json({ error: 'No se pudo actualizar la cuenta' })
      }
      if (!data) return res.status(404).json({ error: 'Cuenta no encontrada' })
      return res.status(200).json({ account: data })
    }

    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en cuenta'
    return res.status(500).json({ error: message })
  }
}
