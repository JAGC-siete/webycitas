/**
 * Edición y borrado de un producto. El saldo no se acepta en este cuerpo.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../lib/logger'
import { updateInventoryProductSchema } from '../../../../lib/landings/inventory-schema'
import { toInventoryProductView, type InventoryProductRow } from '../../../../lib/landings/inventory'
import { PRODUCTS_TABLE } from '../../../../lib/landings/inventory-server'
import { requireSuiteApi } from '../../../../lib/suite/tenant'

const UNIQUE_VIOLATION = '23505'
const PRODUCT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function productIdOf(req: NextApiRequest): string | null {
  const raw = req.query.productId
  const id = Array.isArray(raw) ? raw[0] : raw
  if (!id || !PRODUCT_ID_RE.test(id)) return null
  return id
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'inventario' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  const siteId = ctx.tenant.site.id
  const productId = productIdOf(req)
  if (!productId) return res.status(400).json({ error: 'Identificador inválido' })

  try {
    if (req.method === 'PATCH') {
      if (req.body && typeof req.body === 'object' && ('stockActual' in req.body || 'stock_actual' in req.body)) {
        return res.status(400).json({ error: 'El saldo se cambia con un movimiento.' })
      }

      const parsed = updateInventoryProductSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
      }

      const patch: Record<string, unknown> = {}
      if (parsed.data.nombre !== undefined) patch.nombre = parsed.data.nombre
      if (parsed.data.sku !== undefined) patch.sku = parsed.data.sku
      if (parsed.data.precio !== undefined) patch.precio = parsed.data.precio
      if (parsed.data.stockMinimo !== undefined) patch.stock_minimo = parsed.data.stockMinimo

      const { data, error } = await ctx.supabase
        .from(PRODUCTS_TABLE)
        .update(patch)
        .eq('id', productId)
        .eq('site_id', siteId)
        .select('id, nombre, sku, precio, stock_actual, stock_minimo')
        .maybeSingle()

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          return res.status(409).json({ error: 'Ese SKU ya existe en tu inventario.' })
        }
        logger.error('Error editando producto', { siteId, productId, error: error.message })
        return res.status(500).json({ error: 'No se pudo guardar el producto' })
      }
      if (!data) return res.status(404).json({ error: 'Producto no encontrado' })
      return res.status(200).json({ product: toInventoryProductView(data as InventoryProductRow) })
    }

    if (req.method === 'DELETE') {
      const { data, error } = await ctx.supabase
        .from(PRODUCTS_TABLE)
        .delete()
        .eq('id', productId)
        .eq('site_id', siteId)
        .select('id')
        .maybeSingle()

      if (error) {
        logger.error('Error borrando producto', { siteId, productId, error: error.message })
        return res.status(500).json({ error: 'No se pudo borrar el producto' })
      }
      if (!data) return res.status(404).json({ error: 'Producto no encontrado' })
      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', 'PATCH, DELETE')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en inventario'
    return res.status(500).json({ error: message })
  }
}
