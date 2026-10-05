import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import { dateOnlySchema } from '../../../../../lib/suite/accounting/schemas'
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  loadPostedLineAggs,
} from '../../../../../lib/suite/accounting/report-query'
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
  const asOf = parsed.data
  const yearStart = `${asOf.slice(0, 4)}-01-01`

  const [bsLoaded, plLoaded] = await Promise.all([
    loadPostedLineAggs(ctx.supabase, siteId, {
      asOf,
      types: ['asset', 'liability', 'equity'],
    }),
    loadPostedLineAggs(ctx.supabase, siteId, {
      from: yearStart,
      to: asOf,
      types: ['revenue', 'expense'],
    }),
  ])

  if (bsLoaded.error || plLoaded.error) {
    logger.error('Error balance sheet', {
      siteId,
      error: bsLoaded.error || plLoaded.error,
    })
    return res.status(500).json({ error: 'No se pudo generar el balance general' })
  }

  const pl = buildProfitAndLoss(plLoaded.rows)
  return res.status(200).json({
    as_of: asOf,
    fiscal_year_start: yearStart,
    ...buildBalanceSheet(bsLoaded.rows, pl.net_income_cents),
  })
}
