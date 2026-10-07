/**
 * Textos y plantillas del editor según quién edita.
 *
 * `ops` ve el editor técnico completo. `owner` (dueño en /app/sitio) ve nombres
 * en español llano y sin campos que pueden romper la plantilla.
 */

import type { LandingBlock } from '../../types/landing'
import { formatInventoryPrice, type InventoryProductView } from './inventory'

export type EditorMode = 'owner' | 'ops'

const OWNER_BLOCK_NAMES: Record<LandingBlock['kind'], string> = {
  hero: 'Portada',
  items: 'Productos',
  gallery: 'Galería de fotos',
  text: 'Texto',
  hours: 'Horario',
  testimonials: 'Opiniones de clientes',
  faq: 'Preguntas frecuentes',
  leadForm: 'Formulario de contacto',
  contact: 'Contacto',
  cta: 'Banner',
  visit: 'Cómo llegar',
  benefits: 'Por qué elegirnos',
  team: 'Equipo',
  areas: 'Secciones de la tienda',
}

/** Nombre del bloque en la cabecera del acordeón. */
export function blockDisplayName(kind: string, mode: EditorMode): string {
  if (mode === 'ops') return kind
  return OWNER_BLOCK_NAMES[kind as LandingBlock['kind']] ?? 'Sección'
}

export const OWNER_CTA_ACTIONS = [
  { value: 'whatsapp', label: 'Escribir por WhatsApp' },
  { value: 'call', label: 'Llamar' },
  { value: 'maps', label: 'Cómo llegar (Google Maps)' },
  { value: 'lead-form', label: 'Abrir el formulario de contacto' },
  { value: 'link', label: 'Ir a un enlace' },
] as const

export const OPS_CTA_ACTIONS = [
  { value: 'lead-form', label: 'Formulario' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Llamar' },
  { value: 'maps', label: 'Mapas' },
  { value: 'link', label: 'Link' },
] as const

/**
 * Elemento vacío para "Agregar" en cada lista. Los campos obligatorios quedan
 * en blanco a propósito: el validador marca qué falta antes de publicar.
 */
export const NEW_ARRAY_ITEM = {
  items: () => ({ name: '', detail: '', category: '', priceLabel: '' }),
  images: () => ({ url: '', alt: '' }),
  rows: () => ({ label: '', value: '' }),
  testimonials: () => ({ author: '', role: '', quote: '' }),
  faq: () => ({ question: '', answer: '' }),
  benefits: () => ({ mark: '✦', title: '', body: '' }),
  team: () => ({ name: '', role: '', bio: '' }),
} as const

export interface InventoryItemDraft {
  name: string
  priceLabel: string
  imageUrl?: string
  inventoryProductId: string
}

/** Producto del inventario → ítem de la página, ya vinculado. */
export function itemFromInventoryProduct(
  product: Pick<InventoryProductView, 'id' | 'nombre' | 'precio' | 'imageUrl'>
): InventoryItemDraft {
  return {
    name: product.nombre.slice(0, 80),
    priceLabel: formatInventoryPrice(product.precio),
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    inventoryProductId: product.id,
  }
}

/** Productos del inventario que todavía no están en este bloque. */
export function unlinkedInventory<T extends { id: string }>(
  products: readonly T[],
  items: readonly { inventoryProductId?: string | null }[] | undefined
): T[] {
  const linked = new Set((items ?? []).map((item) => item.inventoryProductId).filter(Boolean))
  return products.filter((product) => !linked.has(product.id))
}
