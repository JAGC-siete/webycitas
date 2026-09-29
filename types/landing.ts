/**
 * Tipos del motor de maquetas. Las reglas viven en lib/landings/page-schema.ts.
 * El dueño de un site es leads.id (sites.lead_id). No hay company_id.
 */

import type {
  LandingBlock,
  LandingBlockKind,
  LandingCta,
  LandingCtaAction,
  LandingPageBusiness,
  LandingPageContent,
  LandingPageContentInput,
  LandingPageMeta,
  LandingPageStatus,
  LandingPageTheme,
  LandingTemplateKey,
} from '../lib/landings/page-schema'

export type {
  LandingBlock,
  LandingBlockKind,
  LandingCta,
  LandingCtaAction,
  LandingPageBusiness,
  LandingPageContent,
  LandingPageContentInput,
  LandingPageMeta,
  LandingPageStatus,
  LandingPageTheme,
  LandingTemplateKey,
}

export interface SiteRow {
  id: string
  lead_id: string
  title: string
  slug: string
  template_type: LandingTemplateKey
  status: LandingPageStatus
  schema_version: number
  content_json: unknown
  published_content_json: unknown | null
  lead_notify_email: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

/** Alias histórico del renderer: fila pública de sites. */
export type LandingPagePublicRow = Pick<
  SiteRow,
  'id' | 'slug' | 'title' | 'template_type' | 'status' | 'schema_version' | 'published_content_json' | 'published_at'
>

export interface SiteInquiryRow {
  id: string
  site_id: string
  full_name: string
  email: string | null
  phone: string | null
  message: string | null
  extra: unknown
  source: string
  notified_at: string | null
  created_at: string
}

export interface PublicLandingPage {
  id: string
  slug: string
  title: string
  templateType: LandingTemplateKey
  content: LandingPageContent
}
