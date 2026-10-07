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

const FIELD_NAMES: Record<string, string> = {
  name: 'Nombre',
  title: 'Título',
  subtitle: 'Subtítulo',
  headline: 'Título principal',
  subheadline: 'Texto debajo del título',
  badge: 'Etiqueta pequeña',
  label: 'Texto',
  href: 'Enlace',
  message: 'Mensaje',
  question: 'Pregunta',
  answer: 'Respuesta',
  priceLabel: 'Precio',
  detail: 'Descripción',
  category: 'Categoría',
  imageUrl: 'Foto',
  url: 'Foto',
  alt: 'Descripción de la foto',
  author: 'Nombre',
  quote: 'Opinión',
  role: 'Detalle',
  mark: 'Ícono',
  body: 'Texto',
  value: 'Horario',
  primaryCta: 'Botón principal',
  secondaryCta: 'Botón secundario',
  whatsapp: 'WhatsApp',
  phone: 'Teléfono',
  email: 'Correo',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  address: 'Dirección',
  city: 'Ciudad',
  tagline: 'Frase corta',
}

/** `items.6.name` → `#7 · Nombre`. Las listas cuentan desde 1, como en pantalla. */
export function friendlyErrorPath(path: string): string {
  const parts: string[] = []
  for (const segment of path.split('.')) {
    if (!segment) continue
    if (/^\d+$/.test(segment)) {
      parts.push(`#${Number(segment) + 1}`)
      continue
    }
    const label = FIELD_NAMES[segment]
    if (label) parts.push(label)
  }
  return parts.join(' · ')
}

/** Mensajes por defecto de zod → español llano. Los mensajes propios ya vienen en español. */
export function friendlyFieldError(message: string): string {
  if (/expected string, received undefined|expected .*received (null|undefined)/i.test(message)) {
    return 'Falta completar este campo.'
  }
  const tooSmall = /too small: expected string to have >=(\d+) characters?/i.exec(message)
  if (tooSmall) {
    return Number(tooSmall[1]) <= 1 ? 'Falta completar este campo.' : `Escribe al menos ${tooSmall[1]} caracteres.`
  }
  const tooBig = /too big: expected string to have <=(\d+) characters?/i.exec(message)
  if (tooBig) return `Es muy largo: máximo ${tooBig[1]} caracteres.`
  if (/invalid email/i.test(message)) return 'Revisa el correo: no parece válido.'
  if (/^invalid input/i.test(message)) return 'Revisa este campo.'
  return message
}
