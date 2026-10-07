/**
 * Cliente suite para el editor de sitio del dueño.
 */

import { suiteFetch } from '../auth/client-session'
import type {
  LandingEditRecord,
  PublishLandingResult,
  SaveLandingDraftInput,
} from '../landings/editor-types'
import type { LandingTemplateKey } from '../../types/landing'
import { SUITE_SITE_CONTENT_API, SUITE_SITE_PUBLISH_API } from './paths'

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error || fallback
}

type SuiteSiteRow = {
  id: string
  slug: string
  title: string
  status: LandingEditRecord['status']
  template_type?: LandingTemplateKey | null
  content_json: unknown
  lead_notify_email: string | null
  published_at: string | null
  has_unpublished_changes?: boolean
}

function toEditRecord(site: SuiteSiteRow): LandingEditRecord {
  return {
    id: site.id,
    title: site.title,
    slug: site.slug,
    template_type: site.template_type || 'papeleria',
    status: site.status,
    content_json: site.content_json,
    lead_notify_email: site.lead_notify_email,
    published_at: site.published_at,
    has_unpublished_changes: site.has_unpublished_changes ?? false,
  }
}

export async function fetchSuiteSite(): Promise<{ landing: LandingEditRecord }> {
  const res = await suiteFetch(SUITE_SITE_CONTENT_API)
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar el sitio'))
  const body = (await res.json()) as { site?: SuiteSiteRow }
  if (!body.site) throw new Error('Sitio no encontrado')
  return { landing: toEditRecord(body.site) }
}

export async function saveSuiteSite(
  input: SaveLandingDraftInput
): Promise<{ landing: LandingEditRecord }> {
  const res = await suiteFetch(SUITE_SITE_CONTENT_API, {
    method: 'PATCH',
    body: JSON.stringify({
      title: input.title,
      lead_notify_email: input.leadNotifyEmail,
      content_json: input.content,
    }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar'))
  const body = (await res.json()) as { site?: SuiteSiteRow }
  if (!body.site) throw new Error('Respuesta inválida al guardar')
  return { landing: toEditRecord(body.site) }
}

export async function publishSuiteSite(
  action: 'publish' | 'unpublish'
): Promise<PublishLandingResult> {
  const res = await suiteFetch(SUITE_SITE_PUBLISH_API, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cambiar la publicación'))
  const body = (await res.json()) as { site?: PublishLandingResult }
  if (!body.site) throw new Error('Respuesta inválida al publicar')
  return { status: body.site.status, published_at: body.site.published_at }
}
