/**
 * Contratos del panel de inventario. El saldo no entra por aquí: solo un movimiento lo cambia.
 * Límites alineados con CHECK de public.products (client_suite).
 */

import { z } from 'zod'
import { landingUrlSchema } from './page-schema'

const nombre = z
  .string()
  .trim()
  .min(2, 'El nombre necesita al menos 2 caracteres.')
  .max(120, 'El nombre no puede pasar de 120 caracteres.')

const sku = z
  .string()
  .trim()
  .min(1, 'El SKU es obligatorio.')
  .max(40, 'El SKU no puede pasar de 40 caracteres.')
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    'El SKU solo admite letras, números, punto, guion y guion bajo.'
  )

const precio = z.number().finite().min(0, 'El precio no puede ser negativo.').max(99_999_999)
const stockMinimo = z.number().int().min(0, 'El mínimo no puede ser negativo.')
const stockInicial = z.number().int().min(0).optional()
const imageUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  landingUrlSchema.nullable().optional()
)

export const createInventoryProductSchema = z.object({
  nombre,
  sku,
  precio,
  stockMinimo,
  stockInicial,
  imageUrl,
})

export const updateInventoryProductSchema = z
  .object({
    nombre: nombre.optional(),
    sku: sku.optional(),
    precio: precio.optional(),
    stockMinimo: stockMinimo.optional(),
    imageUrl,
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No hay cambios.' })

/** Tope por movimiento: evita un dedazo de 100000 frascos. */
export const INVENTORY_MOVEMENT_MAX = 10_000

export const inventoryMovementSchema = z.object({
  delta: z
    .number()
    .int()
    .min(-INVENTORY_MOVEMENT_MAX)
    .max(INVENTORY_MOVEMENT_MAX)
    .refine((value) => value !== 0),
})

export type MoveKind = 'in' | 'out'

/** Cantidad del diálogo → delta firmado, o el error a mostrar. */
export function movementDelta(
  kind: MoveKind,
  rawQty: string,
  stock: number
): { delta: number; error: null } | { delta: null; error: string } {
  const qty = Number(rawQty.trim())
  if (!rawQty.trim() || !Number.isInteger(qty) || qty < 1 || qty > INVENTORY_MOVEMENT_MAX) {
    return {
      delta: null,
      error: `Escribe una cantidad entera entre 1 y ${INVENTORY_MOVEMENT_MAX.toLocaleString('es-HN')}.`,
    }
  }
  if (kind === 'out' && qty > stock) {
    return { delta: null, error: `Solo hay ${stock} en stock.` }
  }
  return { delta: kind === 'in' ? qty : -qty, error: null }
}

export type CreateInventoryProductInput = z.infer<typeof createInventoryProductSchema>
export type UpdateInventoryProductInput = z.infer<typeof updateInventoryProductSchema>
