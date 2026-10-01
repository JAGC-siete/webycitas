import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireSuperAdmin } from '../../../../lib/auth/api-auth'
import { normalizeEmail } from '../../../../lib/auth/credentials'
import { inviteOwnerAccess } from '../../../../lib/auth/invite-owner'
import { logger } from '../../../../lib/logger'
import { createAdminClient } from '../../../../lib/supabase/admin'

const schema = z.object({
  lead_id: z.string().uuid().optional(),
  email: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  const actor = await requireSuperAdmin(req, res, 'invite_owner')
  if (!actor) return

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })

  const admin = createAdminClient()
  let email = normalizeEmail(parsed.data.email)
  let businessName: string | null = null

  if (parsed.data.lead_id) {
    const { data: lead, error } = await admin
      .from('leads')
      .select('id, email, status, business_name')
      .eq('id', parsed.data.lead_id)
      .maybeSingle()
    if (error || !lead) return res.status(404).json({ error: 'Lead no encontrado' })
    if (lead.status === 'rejected') return res.status(400).json({ error: 'Lead descartado' })
    email = normalizeEmail(lead.email)
    businessName = lead.business_name
  }

  if (!email.includes('@')) return res.status(400).json({ error: 'Correo inválido' })

  try {
    const result = await inviteOwnerAccess(admin, {
      email,
      businessName,
      leadId: parsed.data.lead_id,
    })
    return res.status(200).json({
      ok: true,
      email: result.email,
      channel: result.channel,
      message: result.message,
      action_link: result.action_link ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo invitar'
    logger.error('invite_owner falló', { email, error: message })
    return res.status(500).json({ error: message })
  }
}
