/**
 * Lectura y movimientos de inventario del site.
 * El saldo solo se mueve con inventory_apply_movement (sesión del owner).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { toInventoryProductView, type InventoryProductRow, type InventoryProductView } from './inventory'

export const PRODUCTS_TABLE = 'products'

const PRODUCT_COLUMNS = 'id, nombre, sku, precio, stock_actual, stock_minimo, image_url'

export async function listInventoryProducts(
  supabase: SupabaseClient,
  siteId: string
): Promise<{ products: InventoryProductView[]; error: string | null }> {
  const { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .select(PRODUCT_COLUMNS)
    .eq('site_id', siteId)
    .order('nombre', { ascending: true })

  if (error) return { products: [], error: error.message }
  return {
    products: ((data ?? []) as InventoryProductRow[]).map(toInventoryProductView),
    error: null,
  }
}

export async function applyInventoryMovement(
  supabase: SupabaseClient,
  productId: string,
  siteId: string,
  delta: number
): Promise<{ product: InventoryProductView | null; status: number; error: string | null }> {
  const { data: owned, error: ownedError } = await supabase
    .from(PRODUCTS_TABLE)
    .select('id')
    .eq('id', productId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (ownedError) return { product: null, status: 500, error: 'No se pudo mover el stock' }
  if (!owned) return { product: null, status: 404, error: 'Producto no encontrado' }

  const { data, error } = await supabase.rpc('inventory_apply_movement', {
    p_product_id: productId,
    p_delta: delta,
  })

  if (error) {
    const message = error.message ?? ''
    if (message.includes('stock_negative')) {
      return { product: null, status: 409, error: 'No hay stock para sacar.' }
    }
    if (message.includes('no_tenant') || message.includes('product_not_found')) {
      return { product: null, status: 404, error: 'Producto no encontrado' }
    }
    return { product: null, status: 500, error: 'No se pudo mover el stock' }
  }

  const row = (Array.isArray(data) ? data[0] : data) as InventoryProductRow | null
  if (!row?.id) return { product: null, status: 500, error: 'No se pudo mover el stock' }
  return { product: toInventoryProductView(row), status: 200, error: null }
}
