import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireSuiteApi } from '../../../../lib/suite/tenant'
import { landingPageContentSchema } from '../../../../lib/landings/page-schema'

const SITE_EDITOR_COLUMNS =
  'id, slug, title, status, template_type, content_json, lead_notify_email, published_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'sitio' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  const siteId = ctx.tenant.site.id

  try {
    if (req.method === 'GET') {
      const { data, error } = await ctx.supabase
        .from('sites')
        .select(SITE_EDITOR_COLUMNS)
        .eq('id', siteId)
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Sitio no encontrado' })
      return res.status(200).json({ site: data })
    }

    if (req.method === 'PATCH') {
      const schema = z.object({
        title: z.string().trim().min(2).max(120).optional(),
        lead_notify_email: z.string().email().nullable().optional().or(z.literal('')),
        content_json: z.unknown().optional(),
      })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })

      const patch: Record<string, unknown> = {}
      if (parsed.data.title !== undefined) patch.title = parsed.data.title
      if (parsed.data.lead_notify_email !== undefined) {
        patch.lead_notify_email = parsed.data.lead_notify_email || null
      }
      if (parsed.data.content_json !== undefined) {
        const content = landingPageContentSchema.safeParse(parsed.data.content_json)
        if (!content.success) return res.status(400).json({ error: 'Contenido inválido' })
        patch.content_json = content.data
      }

      const { data, error } = await ctx.supabase
        .from('sites')
        .update(patch)
        .eq('id', siteId)
        .select(SITE_EDITOR_COLUMNS)
        .maybeSingle()
      if (error) throw error
      return res.status(200).json({ site: data })
    }

    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en contenido'
    return res.status(500).json({ error: message })
  }
}
