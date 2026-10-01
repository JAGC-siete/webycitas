import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireSuperAdmin } from '../../../../lib/auth/api-auth'
import { normalizeEmail } from '../../../../lib/auth/credentials'
import { OWNER_ROLE } from '../../../../lib/auth/role-access'
import { logger } from '../../../../lib/logger'
import { siteAbsoluteUrl } from '../../../../lib/site'
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

  if (parsed.data.lead_id) {
    const { data: lead, error } = await admin
      .from('leads')
      .select('id, email, status')
      .eq('id', parsed.data.lead_id)
      .maybeSingle()
    if (error || !lead) return res.status(404).json({ error: 'Lead no encontrado' })
    if (lead.status === 'rejected') return res.status(400).json({ error: 'Lead descartado' })
    email = normalizeEmail(lead.email)
  }

  if (!email.includes('@')) return res.status(400).json({ error: 'Correo inválido' })

  const redirectTo = siteAbsoluteUrl('/auth/update-password?next=/app/login')

  try {
    const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    let userId = invited.data.user?.id ?? null

    if (invited.error || !userId) {
      const recovered = await admin.auth.resetPasswordForEmail(email, { redirectTo })
      if (recovered.error) {
        logger.warn('Invite owner no pudo enviar correo', { error: invited.error?.message || recovered.error.message })
      }
      const generated = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      })
      userId = generated.data.user?.id ?? null
    }

    if (!userId) return res.status(500).json({ error: 'No se pudo resolver el usuario' })

    const { error: profileError } = await admin.from('user_profiles').upsert(
      { id: userId, role: OWNER_ROLE, is_active: true },
      { onConflict: 'id' }
    )
    if (profileError) throw profileError

    return res.status(200).json({ ok: true, email })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo invitar'
    return res.status(500).json({ error: message })
  }
}
