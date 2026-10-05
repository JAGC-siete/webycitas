/**
 * Contratos del panel de inventario. El saldo no entra por aquí: solo un movimiento lo cambia.
 * Límites alineados con CHECK de public.products (client_suite).
 */

import { z } from 'zod'

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

export const createInventoryProductSchema = z.object({
  nombre,
  sku,
  precio,
  stockMinimo,
  stockInicial,
})

export const updateInventoryProductSchema = z
  .object({
    nombre: nombre.optional(),
    sku: sku.optional(),
    precio: precio.optional(),
    stockMinimo: stockMinimo.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No hay cambios.' })

export const inventoryMovementSchema = z.object({
  delta: z.union([z.literal(1), z.literal(-1)]),
})

export type CreateInventoryProductInput = z.infer<typeof createInventoryProductSchema>
export type UpdateInventoryProductInput = z.infer<typeof updateInventoryProductSchema>
