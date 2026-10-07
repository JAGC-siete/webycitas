/**
 * Cliente del panel owner para /api/suite/inventory.
 */

import { suiteFetch } from '../auth/client-session'
import type {
  CreateInventoryProductInput,
  UpdateInventoryProductInput,
} from '../landings/inventory-schema'
import type { InventoryProductView } from '../landings/inventory'
import {
  SUITE_INVENTORY_API,
  suiteInventoryProductApi,
  suiteInventoryMovementApi,
} from './paths'

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error || fallback
}

export async function fetchSuiteInventory(): Promise<{ products: InventoryProductView[] }> {
  const res = await suiteFetch(SUITE_INVENTORY_API)
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar el inventario'))
  return (await res.json()) as { products: InventoryProductView[] }
}

export async function createSuiteInventoryProduct(
  input: CreateInventoryProductInput
): Promise<{ product: InventoryProductView | null }> {
  const res = await suiteFetch(SUITE_INVENTORY_API, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo crear el producto'))
  return (await res.json()) as { product: InventoryProductView | null }
}

export async function updateSuiteInventoryProduct(
  productId: string,
  input: UpdateInventoryProductInput
): Promise<{ product: InventoryProductView }> {
  const res = await suiteFetch(suiteInventoryProductApi(productId), {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar'))
  return (await res.json()) as { product: InventoryProductView }
}

export async function deleteSuiteInventoryProduct(productId: string): Promise<{ success: true }> {
  const res = await suiteFetch(suiteInventoryProductApi(productId), { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo borrar'))
  return (await res.json()) as { success: true }
}

export async function moveSuiteInventoryStock(
  productId: string,
  delta: number
): Promise<{ product: InventoryProductView }> {
  const res = await suiteFetch(suiteInventoryMovementApi(productId), {
    method: 'POST',
    body: JSON.stringify({ delta }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo mover el stock'))
  return (await res.json()) as { product: InventoryProductView }
}
