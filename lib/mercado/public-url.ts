import { siteAbsoluteUrl, siteOrigin } from '../sigua/site'

export function mercadoPublicOrigin() {
  return siteOrigin()
}

export function mercadoAbsoluteUrl(path: string) {
  return siteAbsoluteUrl(path)
}
