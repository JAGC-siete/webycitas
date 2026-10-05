/**
 * Cliente ops para el editor de landings (super_admin).
 */

import { opsFetch } from '../auth/client-session'
import {
  landingAdminApiPath,
  landingAdminPublishApiPath,
} from './paths'
import type {
  LandingEditRecord,
  PublishLandingResult,
  SaveLandingDraftInput,
} from './editor-types'

export type { LandingEditRecord, SaveLandingDraftInput }

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error || fallback
}

export async function fetchLanding(id: string): Promise<{ landing: LandingEditRecord }> {
  const res = await opsFetch(landingAdminApiPath(id))
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar la landing'))
  return (await res.json()) as { landing: LandingEditRecord }
}

export async function saveLanding(
  id: string,
  input: SaveLandingDraftInput
): Promise<{ landing: LandingEditRecord }> {
  const res = await opsFetch(landingAdminApiPath(id), {
    method: 'PATCH',
    body: JSON.stringify({
      title: input.title,
      slug: input.slug,
      lead_notify_email: input.leadNotifyEmail,
      content_json: input.content,
    }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar'))
  return (await res.json()) as { landing: LandingEditRecord }
}

export async function publishLanding(
  id: string,
  action: 'publish' | 'unpublish'
): Promise<PublishLandingResult> {
  const res = await opsFetch(landingAdminPublishApiPath(id), {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cambiar la publicación'))
  const body = (await res.json()) as {
    site?: PublishLandingResult
  }
  if (!body.site) throw new Error('Respuesta inválida al publicar')
  return { status: body.site.status, published_at: body.site.published_at }
}
