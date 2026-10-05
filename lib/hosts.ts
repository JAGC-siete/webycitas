/** Puertas por subdominio. Las dos apuntan al mismo servicio. Las cookies no llevan Domain=.humanosisu.net. */

const MERCADO_DEFAULT_HOSTS = ['mercado.humanosisu.net']

function hostSet(envName: string, defaults: readonly string[]): Set<string> {
  const extra = (process.env[envName] || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...defaults, ...extra])
}

export function hostnameOf(hostHeader: string): string {
  return hostHeader.split(':')[0].trim().toLowerCase()
}

export function mercadoHostnames(): Set<string> {
  return hostSet('MERCADO_HOSTS', MERCADO_DEFAULT_HOSTS)
}

/** En el subdominio de Mercado, / abre el directorio. El resto de rutas se queda igual.
 * GTM aislado: el magnet de Webycitas no vive en este host (ver lib/product-surfaces.ts).
 */
export function rewritePathForHost(hostHeader: string, pathname: string): string | null {
  if (!mercadoHostnames().has(hostnameOf(hostHeader))) return null
  if (pathname === '/') return '/mercadosanpablosigua'
  return null
}
