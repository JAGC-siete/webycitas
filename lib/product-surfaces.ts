/**
 * Superficies de producto en este deploy. Dos GTM distintos; no cruzar funnel.
 * Webycitas = magnet + sites + suite. Mercado = directorio municipal.
 */

export const PRODUCT_SURFACES = {
  webycitas: {
    id: 'webycitas',
    hostDefault: 'webycitas.humanosisu.net',
    magnetPath: '/',
    brand: 'Webycitas',
  },
  mercado: {
    id: 'mercado',
    hostDefault: 'mercado.humanosisu.net',
    publicPath: '/mercadosanpablosigua',
    brand: 'Mercado San Pablo',
  },
} as const

export type ProductSurfaceId = keyof typeof PRODUCT_SURFACES

/** True si el pathname pertenece al directorio Mercado (no al magnet). */
export function isMercadoPublicPath(pathname: string): boolean {
  return (
    pathname === '/mercadosanpablosigua' ||
    pathname.startsWith('/mercadosanpablosigua/') ||
    pathname === '/mercadosanpablosiguav2' ||
    pathname.startsWith('/mercadosanpablosiguav2/')
  )
}
