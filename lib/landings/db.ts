/**
 * Acceso a sites / site_inquiries. Sin company_id: el dueño es leads.id.
 */

import { logger } from '../logger'
import { readLandingPageContent } from './page-schema'
import type { LandingPagePublicRow, PublicLandingPage } from '../../types/landing'

export const SITES_TABLE = 'sites'
export const LEADS_TABLE = 'leads'
export const SITE_INQUIRIES_TABLE = 'site_inquiries'

export const SITE_PUBLIC_COLUMNS =
  'id, slug, title, template_type, status, schema_version, published_content_json, published_at' as const

export function toPublicLandingPage(row: LandingPagePublicRow): PublicLandingPage | null {
  const read = readLandingPageContent(row.published_content_json)

  if (!read.ok) {
    logger.error('Snapshot de site no renderizable', {
      siteId: row.id,
      slug: row.slug,
      reason: read.reason,
    })
    return null
  }

  if (read.dropped.length > 0) {
    logger.warn('Bloques descartados al renderizar site', {
      siteId: row.id,
      slug: row.slug,
      dropped: read.dropped,
    })
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    templateType: row.template_type,
    content: read.content,
  }
}
