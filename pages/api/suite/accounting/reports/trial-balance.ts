import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import { dateOnlySchema } from '../../../../../lib/suite/accounting/schemas'
import { buildTrialBalance, loadPostedLineAggs } from '../../../../../lib/suite/accounting/report-query'
import { requireSuiteApi } from '../../../../../lib/suite/tenant'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'contabilidad' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const asOfRaw = typeof req.query.as_of === 'string' ? req.query.as_of : ''
  const parsed = dateOnlySchema.safeParse(asOfRaw)
  if (!parsed.success) return res.status(400).json({ error: 'as_of inválido (YYYY-MM-DD)' })

  const siteId = ctx.tenant.site.id
  const loaded = await loadPostedLineAggs(ctx.supabase, siteId, { asOf: parsed.data })
  if (loaded.error) {
    logger.error('Error trial balance', { siteId, error: loaded.error })
    return res.status(500).json({ error: 'No se pudo generar la balanza' })
  }

  return res.status(200).json({
    as_of: parsed.data,
    ...buildTrialBalance(loaded.rows),
  })
}
