import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireSuiteApi } from '../../../../lib/suite/tenant'
import { landingPageContentSchema } from '../../../../lib/landings/page-schema'
import { formatLempirasFromCents } from '../../../../lib/suite/schemas'
import { createAdminClient } from '../../../../lib/supabase/admin'

const bodySchema = z.object({
  action: z.enum(['publish', 'unpublish']).optional().default('publish'),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const ctx = await requireSuiteApi(req, res, { module: 'sitio' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  const siteId = ctx.tenant.site.id

  const parsedBody = bodySchema.safeParse(req.body ?? {})
  if (!parsedBody.success) return res.status(400).json({ error: 'Acción inválida' })
  const action = parsedBody.data.action

  try {
    const admin = createAdminClient()

    if (action === 'unpublish') {
      const { data: updated, error: updateError } = await admin
        .from('sites')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)
        .eq('lead_id', ctx.tenant.leadId)
        .select('id, slug, status, published_at')
        .maybeSingle()
      if (updateError) throw updateError
      if (!updated) return res.status(404).json({ error: 'Sitio no encontrado' })
      return res.status(200).json({ site: updated })
    }

    const { data: site, error } = await ctx.supabase
      .from('sites')
      .select('id, slug, content_json')
      .eq('id', siteId)
      .maybeSingle()
    if (error) throw error
    if (!site) return res.status(404).json({ error: 'Sitio no encontrado' })

    const parsed = landingPageContentSchema.safeParse(site.content_json)
    if (!parsed.success) return res.status(400).json({ error: 'El borrador no es válido para publicar' })

    const { data: services } = await ctx.supabase
      .from('bookable_services')
      .select('name, price_cents, duration_min, is_active')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const content = structuredClone(parsed.data)
    if (services && services.length > 0) {
      const itemsBlock = content.blocks.find((b) => b.kind === 'items')
      if (itemsBlock && itemsBlock.kind === 'items') {
        itemsBlock.items = services.map((s) => ({
          name: s.name,
          detail: `${formatLempirasFromCents(s.price_cents)} · ${s.duration_min} min`,
          priceLabel: formatLempirasFromCents(s.price_cents),
        }))
      }
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await admin
      .from('sites')
      .update({
        status: 'published',
        published_content_json: content,
        published_at: now,
        content_json: content,
        updated_at: now,
      })
      .eq('id', siteId)
      .eq('lead_id', ctx.tenant.leadId)
      .select('id, slug, status, published_at')
      .maybeSingle()
    if (updateError) throw updateError

    return res.status(200).json({ site: updated, preview: `/p/${site.slug}` })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo publicar'
    return res.status(500).json({ error: message })
  }
}
