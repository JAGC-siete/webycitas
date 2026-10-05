/**
 * Lista y alta de productos del site del owner.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../lib/logger'
import { createInventoryProductSchema } from '../../../../lib/landings/inventory-schema'
import {
  PRODUCTS_TABLE,
  applyInventoryMovement,
  listInventoryProducts,
} from '../../../../lib/landings/inventory-server'
import { requireSuiteApi } from '../../../../lib/suite/tenant'

const UNIQUE_VIOLATION = '23505'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'inventario' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  const siteId = ctx.tenant.site.id

  try {
    if (req.method === 'GET') {
      const listed = await listInventoryProducts(ctx.supabase, siteId)
      if (listed.error) {
        logger.error('Error listando inventario', { siteId, error: listed.error })
        return res.status(500).json({ error: 'No se pudo cargar el inventario' })
      }
      return res.status(200).json({ products: listed.products })
    }

    if (req.method === 'POST') {
      const parsed = createInventoryProductSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
      }

      const { nombre, sku, precio, stockMinimo, stockInicial } = parsed.data
      const { data, error } = await ctx.supabase
        .from(PRODUCTS_TABLE)
        .insert({
          site_id: siteId,
          nombre,
          sku,
          precio,
          stock_minimo: stockMinimo,
        })
        .select('id')
        .single()

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          return res.status(409).json({ error: 'Ese SKU ya existe en tu inventario.' })
        }
        logger.error('Error creando producto', { siteId, error: error.message })
        return res.status(500).json({ error: 'No se pudo crear el producto' })
      }

      const createdId = (data as { id: string }).id
      if (stockInicial && stockInicial > 0) {
        const moved = await applyInventoryMovement(ctx.supabase, createdId, siteId, stockInicial)
        if (moved.error || !moved.product) {
          await ctx.supabase.from(PRODUCTS_TABLE).delete().eq('id', createdId).eq('site_id', siteId)
          return res.status(moved.status).json({ error: moved.error })
        }
        return res.status(201).json({ product: moved.product })
      }

      const listed = await listInventoryProducts(ctx.supabase, siteId)
      const product = listed.products.find((item) => item.id === createdId) ?? null
      return res.status(201).json({ product })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en inventario'
    return res.status(500).json({ error: message })
  }
}
