/**
 * Los dos productos que sirve este deploy, uno por host (ver lib/hosts.ts).
 * Webycitas = magnet + sites + suite. Mercado = directorio de negocios de Siguatepeque.
 */

import { SIGUA_PAGES_PREFIX } from './mercado/paths'

export const PRODUCT_SURFACES = {
  webycitas: {
    id: 'webycitas',
    hostDefault: 'webycitas.humanosisu.net',
    magnetPath: '/',
    brand: 'Webycitas',
  },
  mercado: {
    id: 'mercado',
    hostDefault: 'sigua-online.com',
    publicPath: '/',
    pagesPrefix: SIGUA_PAGES_PREFIX,
    brand: 'Mercado Digital de Siguatepeque',
  },
} as const

export type ProductSurfaceId = keyof typeof PRODUCT_SURFACES

/** True si la ruta de la página (router.pathname) pertenece al directorio y no a Webycitas. */
export function isMercadoPublicPath(pathname: string): boolean {
  return pathname === SIGUA_PAGES_PREFIX || pathname.startsWith(`${SIGUA_PAGES_PREFIX}/`)
}
