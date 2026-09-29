/**
 * Resolución del tenant del panel.
 *
 * El tenant es leads.id y SIEMPRE sale de la sesión: el navegador nunca manda
 * un identificador de negocio. Toda consulta de datos usa el cliente con RLS,
 * y además filtra de forma explícita, para que una política mal escrita no
 * alcance para ver datos de otro negocio.
 */

import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LEADS_TABLE, SITES_TABLE } from '../landings/db'
import { logger } from '../logger'
import { createSuiteServerClient } from './supabase-server'
import { modulesForServices, suiteModule, type SuiteModuleKey } from './modules'

export const SUITE_LOGIN_PATH = '/app/login'
export const SUITE_HOME_PATH = '/app'

const LEAD_COLUMNS = 'id, owner_name, business_name, email, city, rubro, services, status, site_id'
const SITE_COLUMNS = 'id, slug, title, status, published_at, updated_at'

export interface SuiteSite {
  id: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'archived'
  publishedAt: string | null
  updatedAt: string
}

export interface SuiteTenant {
  leadId: string
  ownerName: string
  businessName: string
  email: string
  city: string
  rubro: string
  modules: SuiteModuleKey[]
  site: SuiteSite | null
}

export interface SuiteContext {
  tenant: SuiteTenant
  supabase: SupabaseClient
}

type ReqLike = NextApiRequest | GetServerSidePropsContext['req']
type ResLike = NextApiResponse | GetServerSidePropsContext['res']

type LeadRow = {
  id: string
  owner_name: string
  business_name: string
  email: string
  city: string
  rubro: string
  services: string[] | null
  status: string
  site_id: string | null
}

type SiteRow = {
  id: string
  slug: string
  title: string
  status: SuiteSite['status']
  published_at: string | null
  updated_at: string
}

/**
 * Devuelve el tenant de la sesión, o null si no hay sesión o el usuario no
 * administra ningún negocio. No responde nada: quien llama decide si redirige
 * o contesta con un código de error.
 */
export async function resolveSuiteContext(req: ReqLike, res: ResLike): Promise<SuiteContext | null> {
  const supabase = createSuiteServerClient(req, res)

  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth?.user) return null

  const { data: leadData, error: leadError } = await supabase
    .from(LEADS_TABLE)
    .select(LEAD_COLUMNS)
    .maybeSingle()

  if (leadError) {
    logger.error('No se pudo leer el negocio de la sesión', {
      userId: auth.user.id,
      error: leadError.message,
    })
    return null
  }

  const lead = (leadData as LeadRow | null) ?? null
  if (!lead || lead.status === 'rejected') return null

  const { data: siteData, error: siteError } = await supabase
    .from(SITES_TABLE)
    .select(SITE_COLUMNS)
    .eq('lead_id', lead.id)
    .maybeSingle()

  if (siteError) {
    logger.error('No se pudo leer el sitio del negocio', {
      leadId: lead.id,
      error: siteError.message,
    })
  }

  const siteRow = (siteData as SiteRow | null) ?? null

  return {
    supabase,
    tenant: {
      leadId: lead.id,
      ownerName: lead.owner_name,
      businessName: lead.business_name,
      email: lead.email,
      city: lead.city,
      rubro: lead.rubro,
      modules: modulesForServices(lead.services ?? []),
      site: siteRow
        ? {
            id: siteRow.id,
            slug: siteRow.slug,
            title: siteRow.title,
            status: siteRow.status,
            publishedAt: siteRow.published_at,
            updatedAt: siteRow.updated_at,
          }
        : null,
    },
  }
}

/** Serializable para props de página: el cliente de Supabase no cruza a React. */
export function tenantProps(tenant: SuiteTenant): { tenant: SuiteTenant } {
  return { tenant: JSON.parse(JSON.stringify(tenant)) as SuiteTenant }
}

/**
 * Guard para getServerSideProps. Sin sesión redirige al login; sin el módulo
 * contratado manda al panel en vez de mostrar una página vacía.
 */
export async function requireSuitePage(
  ctx: GetServerSidePropsContext,
  options: { module?: SuiteModuleKey } = {}
): Promise<
  | { ok: true; context: SuiteContext }
  | { ok: false; redirect: { destination: string; permanent: false } }
> {
  const context = await resolveSuiteContext(ctx.req, ctx.res)

  if (!context) {
    const target = ctx.resolvedUrl && ctx.resolvedUrl !== SUITE_HOME_PATH
      ? `${SUITE_LOGIN_PATH}?next=${encodeURIComponent(ctx.resolvedUrl)}`
      : SUITE_LOGIN_PATH
    return { ok: false, redirect: { destination: target, permanent: false } }
  }

  if (options.module && !context.tenant.modules.includes(options.module)) {
    return { ok: false, redirect: { destination: SUITE_HOME_PATH, permanent: false } }
  }

  return { ok: true, context }
}

/** Guard para rutas de API. Responde y devuelve null cuando no procede. */
export async function requireSuiteApi(
  req: NextApiRequest,
  res: NextApiResponse,
  options: { module?: SuiteModuleKey } = {}
): Promise<SuiteContext | null> {
  const context = await resolveSuiteContext(req, res)

  if (!context) {
    res.status(401).json({ error: 'Inicia sesión para continuar' })
    return null
  }

  if (options.module && !context.tenant.modules.includes(options.module)) {
    res.status(403).json({
      error: `El módulo ${suiteModule(options.module).label} no está activo en tu plan`,
      code: 'MODULE_NOT_ENABLED',
    })
    return null
  }

  return context
}
