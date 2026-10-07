/**
 * Entrada o salida de stock. El saldo lo escribe inventory_apply_movement.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import {
  INVENTORY_MOVEMENT_MAX,
  inventoryMovementSchema,
} from '../../../../../lib/landings/inventory-schema'
import { applyInventoryMovement } from '../../../../../lib/landings/inventory-server'
import { requireSuiteApi } from '../../../../../lib/suite/tenant'

const PRODUCT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const ctx = await requireSuiteApi(req, res, { module: 'inventario' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  const rawProduct = req.query.productId
  const productId = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct
  if (!productId || !PRODUCT_ID_RE.test(productId)) {
    return res.status(400).json({ error: 'Identificador inválido' })
  }

  const parsed = inventoryMovementSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: `La cantidad tiene que ser un entero entre 1 y ${INVENTORY_MOVEMENT_MAX.toLocaleString('es-HN')}.`,
    })
  }

  const siteId = ctx.tenant.site.id
  const moved = await applyInventoryMovement(ctx.supabase, productId, siteId, parsed.data.delta)
  if (moved.error || !moved.product) {
    if (moved.status >= 500) {
      logger.error('Error aplicando movimiento', { siteId, productId, error: moved.error })
    }
    return res.status(moved.status).json({ error: moved.error })
  }

  return res.status(200).json({ product: moved.product })
}
