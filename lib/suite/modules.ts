/**
 * Módulos del panel del cliente.
 *
 * Qué ve cada negocio sale de leads.services (landing, booking, inventory,
 * accounting). El sidebar, el guard del servidor y el gate de UI leen de aquí.
 */

export const SUITE_SERVICES = ['landing', 'booking', 'inventory', 'accounting'] as const
export type SuiteService = (typeof SUITE_SERVICES)[number]

export const SUITE_MODULE_KEYS = ['sitio', 'reservas', 'inventario', 'contabilidad'] as const
export type SuiteModuleKey = (typeof SUITE_MODULE_KEYS)[number]

export interface SuiteModule {
  key: SuiteModuleKey
  label: string
  description: string
  /** Servicio contratado que lo habilita. */
  service: SuiteService
  path: string
}

export const SUITE_MODULES: readonly SuiteModule[] = [
  {
    key: 'sitio',
    label: 'Mi sitio',
    description: 'Tus datos, servicios y precios. Publica cuando quieras.',
    service: 'landing',
    path: '/app/sitio',
  },
  {
    key: 'reservas',
    label: 'Reservas',
    description: 'Las solicitudes que llegan desde tu página.',
    service: 'booking',
    path: '/app/reservas',
  },
  {
    key: 'inventario',
    label: 'Inventario',
    description: 'Productos, precios y saldo.',
    service: 'inventory',
    path: '/app/inventario',
  },
  {
    key: 'contabilidad',
    label: 'Contabilidad',
    description: 'Plan de cuentas, asientos y reportes.',
    service: 'accounting',
    path: '/app/contabilidad',
  },
]

export function isSuiteService(value: string): value is SuiteService {
  return (SUITE_SERVICES as readonly string[]).includes(value)
}

export function suiteModule(key: SuiteModuleKey): SuiteModule {
  const found = SUITE_MODULES.find((item) => item.key === key)
  if (!found) throw new Error(`Módulo desconocido: ${key}`)
  return found
}

/** Servicios crudos de la fila de leads → módulos que el panel debe mostrar. */
export function modulesForServices(services: readonly string[]): SuiteModuleKey[] {
  const contracted = new Set(services.filter(isSuiteService))
  return SUITE_MODULES.filter((item) => contracted.has(item.service)).map((item) => item.key)
}

export function moduleForPath(pathname: string): SuiteModule | null {
  return SUITE_MODULES.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)) ?? null
}
