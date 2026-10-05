/** Rutas del panel owner (/app). */

export const SUITE_HOME_PATH = '/app'
export const SUITE_RESERVAS_PATH = '/app/reservas'
export const SUITE_EQUIPO_PATH = '/app/reservas/equipo'
export const SUITE_SITIO_PATH = '/app/sitio'
export const SUITE_CLIENTES_PATH = '/app/clientes'
export const SUITE_INVENTARIO_PATH = '/app/inventario'
export const SUITE_CONTABILIDAD_PATH = '/app/contabilidad'
export const SUITE_CONTABILIDAD_CUENTAS_PATH = '/app/contabilidad/cuentas'
export const SUITE_CONTABILIDAD_ASIENTOS_PATH = '/app/contabilidad/asientos'
export const SUITE_CONTABILIDAD_REPORTES_PATH = '/app/contabilidad/reportes'

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
export const SUITE_MEDIA_UPLOAD_API = '/api/suite/media/upload'
export const SUITE_ACCOUNTING_ACCOUNTS_API = '/api/suite/accounting/accounts'
export const SUITE_ACCOUNTING_JOURNALS_API = '/api/suite/accounting/journals'
export const SUITE_ACCOUNTING_TRIAL_BALANCE_API = '/api/suite/accounting/reports/trial-balance'
export const SUITE_ACCOUNTING_PROFIT_LOSS_API = '/api/suite/accounting/reports/profit-loss'
export const SUITE_ACCOUNTING_BALANCE_SHEET_API = '/api/suite/accounting/reports/balance-sheet'

export function suiteInventoryProductApi(productId: string): string {
  return `${SUITE_INVENTORY_API}/${productId}`
}

export function suiteInventoryMovementApi(productId: string): string {
  return `${SUITE_INVENTORY_API}/${productId}/movements`
}

export function suiteAccountingAccountApi(accountId: string): string {
  return `${SUITE_ACCOUNTING_ACCOUNTS_API}/${accountId}`
}

export function suiteAccountingJournalApi(entryId: string): string {
  return `${SUITE_ACCOUNTING_JOURNALS_API}/${entryId}`
}

export function suiteAccountingJournalPostApi(entryId: string): string {
  return `${SUITE_ACCOUNTING_JOURNALS_API}/${entryId}/post`
}

export function suiteAccountingJournalReverseApi(entryId: string): string {
  return `${SUITE_ACCOUNTING_JOURNALS_API}/${entryId}/reverse`
}
