/** Rutas del panel owner (/app). */

export const SUITE_HOME_PATH = '/app'
export const SUITE_RESERVAS_PATH = '/app/reservas'
export const SUITE_EQUIPO_PATH = '/app/reservas/equipo'
export const SUITE_SITIO_PATH = '/app/sitio'
export const SUITE_CLIENTES_PATH = '/app/clientes'
export const SUITE_INVENTARIO_PATH = '/app/inventario'

export const SUITE_DASHBOARD_API = '/api/suite/dashboard'
export const SUITE_APPOINTMENTS_API = '/api/suite/appointments'
export const SUITE_BLOCKS_API = '/api/suite/blocks'
export const SUITE_STAFF_API = '/api/suite/staff'
export const SUITE_SERVICES_API = '/api/suite/services'
export const SUITE_CUSTOMERS_API = '/api/suite/customers'
export const SUITE_SITE_CONTENT_API = '/api/suite/site/content'
export const SUITE_SITE_PUBLISH_API = '/api/suite/site/publish'
export const SUITE_INQUIRIES_API = '/api/suite/inquiries'
export const SUITE_INQUIRIES_CONVERT_API = '/api/suite/inquiries/convert'
export const SUITE_INVENTORY_API = '/api/suite/inventory'

export function suiteInventoryProductApi(productId: string): string {
  return `${SUITE_INVENTORY_API}/${productId}`
}

export function suiteInventoryMovementApi(productId: string): string {
  return `${SUITE_INVENTORY_API}/${productId}/movements`
}
