import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireSuperAdmin } from '../../../../../../lib/auth/api-auth'
import { landingPageContentSchema } from '../../../../../../lib/landings/page-schema'
import { createAdminClient } from '../../../../../../lib/supabase/admin'

const bodySchema = z.object({
  action: z.enum(['publish', 'unpublish']),
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const id = landingIdFromQuery(req.query)
  if (!id) return res.status(400).json({ error: 'Id de landing inválido' })

  const operator = await requireSuperAdmin(req, res, 'landing_publish')
  if (!operator) return

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Acción inválida' })

  try {
    const db = createAdminClient()
    const { data: site, error } = await db
      .from('sites')
      .select('id, content_json')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!site) return res.status(404).json({ error: 'Landing no encontrada' })

    if (parsed.data.action === 'unpublish') {
      const { data: updated, error: updateError } = await db
        .from('sites')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, slug, status, published_at')
        .maybeSingle()
      if (updateError) throw updateError
      return res.status(200).json({ site: updated })
    }

    const content = landingPageContentSchema.safeParse(site.content_json)
    if (!content.success) {
      return res.status(400).json({ error: 'El borrador no es válido para publicar' })
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await db
      .from('sites')
      .update({
        status: 'published',
        published_content_json: content.data,
        published_at: now,
        content_json: content.data,
        updated_at: now,
      })
      .eq('id', id)
      .select('id, slug, status, published_at')
      .maybeSingle()
    if (updateError) throw updateError
    return res.status(200).json({ site: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cambiar la publicación'
    return res.status(500).json({ error: message })
  }
}
