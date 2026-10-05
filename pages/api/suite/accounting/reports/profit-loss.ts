import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import { profitLossQuerySchema } from '../../../../../lib/suite/accounting/schemas'
import { buildProfitAndLoss, loadPostedLineAggs } from '../../../../../lib/suite/accounting/report-query'
import { requireSuiteApi } from '../../../../../lib/suite/tenant'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'contabilidad' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const parsed = profitLossQuerySchema.safeParse({
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  })
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Rango inválido' })
  }
  if (parsed.data.from > parsed.data.to) {
    return res.status(400).json({ error: 'from debe ser ≤ to' })
  }

  const siteId = ctx.tenant.site.id
  const loaded = await loadPostedLineAggs(ctx.supabase, siteId, {
    from: parsed.data.from,
    to: parsed.data.to,
    types: ['revenue', 'expense'],
  })
  if (loaded.error) {
    logger.error('Error P&L', { siteId, error: loaded.error })
    return res.status(500).json({ error: 'No se pudo generar el estado de resultados' })
  }

  return res.status(200).json({
    from: parsed.data.from,
    to: parsed.data.to,
    ...buildProfitAndLoss(loaded.rows),
  })
}
