import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireSuperAdmin } from '../../../../../lib/auth/api-auth'
import {
  landingPageContentSchema,
  landingSlugSchema,
} from '../../../../../lib/landings/page-schema'
import { createAdminClient } from '../../../../../lib/supabase/admin'

const EDIT_COLUMNS =
  'id, lead_id, title, slug, template_type, status, content_json, lead_notify_email, published_at, created_at, updated_at'

const patchSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: landingSlugSchema,
  lead_notify_email: z
    .union([z.string().trim().email(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined || v === null ? null : v)),
  content_json: z.unknown(),
})

function landingIdFromQuery(query: NextApiRequest['query']): string | null {
  const raw = query.id
  const id = Array.isArray(raw) ? raw[0] : raw
  if (!id || typeof id !== 'string') return null
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuid.test(id) ? id : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = landingIdFromQuery(req.query)
  if (!id) return res.status(400).json({ error: 'Id de landing inválido' })

  if (req.method === 'GET') {
    const operator = await requireSuperAdmin(req, res, 'landing_get')
    if (!operator) return
    try {
      const db = createAdminClient()
      const { data, error } = await db.from('sites').select(EDIT_COLUMNS).eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Landing no encontrada' })
      return res.status(200).json({ landing: data })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar la landing'
      return res.status(500).json({ error: message })
    }
  }

  if (req.method === 'PATCH') {
    const operator = await requireSuperAdmin(req, res, 'landing_save')
    if (!operator) return
    try {
      const parsed = patchSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
      }

      const content = landingPageContentSchema.safeParse(parsed.data.content_json)
      if (!content.success) {
        return res.status(400).json({ error: 'Contenido inválido', details: content.error.flatten() })
      }

      const db = createAdminClient()
      const { data: existing, error: existingError } = await db
        .from('sites')
        .select('id, slug')
        .eq('id', id)
        .maybeSingle()
      if (existingError) throw existingError
      if (!existing) return res.status(404).json({ error: 'Landing no encontrada' })

      if (parsed.data.slug !== existing.slug) {
        const { data: clash, error: clashError } = await db
          .from('sites')
          .select('id')
          .eq('slug', parsed.data.slug)
          .neq('id', id)
          .maybeSingle()
        if (clashError) throw clashError
        if (clash) return res.status(409).json({ error: 'Ese slug ya está en uso' })
      }

      const { data, error } = await db
        .from('sites')
        .update({
          title: parsed.data.title,
          slug: parsed.data.slug,
          lead_notify_email: parsed.data.lead_notify_email,
          content_json: content.data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(EDIT_COLUMNS)
        .maybeSingle()
      if (error) throw error
      return res.status(200).json({ landing: data })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar'
      return res.status(500).json({ error: message })
    }
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ error: 'Método no permitido' })
}
