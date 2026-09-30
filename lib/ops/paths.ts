/** Panel del operador de Webycitas. No es el operador de Mercado ni el SuperAdmin de Planilla. */

export const OPS_ADMIN_PREFIX = '/admin'
export const OPS_ADMIN_LOGIN_PATH = '/admin/login'
export const OPS_ADMIN_SITES_PATH = '/admin/sites'
export const OPS_ADMIN_INQUIRIES_PATH = '/admin/inquiries'
export const OPS_ADMIN_LOGIN_API_PATH = '/api/admin/ops/login'
export const OPS_ADMIN_LOGOUT_API_PATH = '/api/admin/ops/logout'
export const OPS_ADMIN_LEADS_API_PATH = '/api/admin/ops/leads'
export const OPS_ADMIN_SITES_API_PATH = '/api/admin/ops/sites'
export const OPS_ADMIN_INQUIRIES_API_PATH = '/api/admin/ops/inquiries'

export function opsAdminLoginPath(next?: string): string {
  const allowed =
    next === OPS_ADMIN_PREFIX ||
    (Boolean(next) && next!.startsWith(`${OPS_ADMIN_PREFIX}/`) && !next!.startsWith(OPS_ADMIN_LOGIN_PATH))
  if (!allowed || !next) return OPS_ADMIN_LOGIN_PATH
  return `${OPS_ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}`
}

export function isOpsAdminPath(pathname: string): boolean {
  return pathname === OPS_ADMIN_PREFIX || pathname.startsWith(`${OPS_ADMIN_PREFIX}/`)
}
