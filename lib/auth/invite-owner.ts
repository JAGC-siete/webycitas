import type { SupabaseClient } from '@supabase/supabase-js'
import { emailCta, emailParagraph, wrapEmail } from '../emails'
import { logger } from '../logger'
import { getResendFrom } from '../resend-from'
import { authRedirectOrigin } from '../site'
import { OWNER_ROLE } from './role-access'

export type InviteOwnerChannel = 'invite' | 'access_email' | 'access_link'

export interface ProvisionOwnerResult {
  email: string
  userId: string
  actionLink: string
  /** true si el auth user acaba de crearse vía generateLink invite */
  created: boolean
}

export interface InviteOwnerResult {
  email: string
  userId: string
  channel: InviteOwnerChannel
  action_link?: string
  message: string
}

function ownerRedirectTo(): string {
  return `${authRedirectOrigin()}/auth/update-password`
}

async function sendOwnerAccessEmail(input: {
  email: string
  actionLink: string
  businessName?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY ausente' }

  const title = 'Acceso a tu panel Webycitas'
  const intro = input.businessName
    ? `Creá tu contraseña para administrar <strong>${input.businessName}</strong>.`
    : 'Creá tu contraseña para administrar tu sitio y tus citas.'

  const html = wrapEmail(
    title,
    [
      emailParagraph(intro),
      emailParagraph('Este enlace es de un solo uso. Si expiró, pedí otra invitación al operador.'),
      emailCta(input.actionLink, 'Crear contraseña y entrar'),
    ].join('')
  )

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const sent = await resend.emails.send({
    from: getResendFrom(),
    to: input.email,
    subject: title,
    html,
  })
  if (sent.error) return { ok: false, error: sent.error.message }
  return { ok: true }
}

async function upsertOwnerProfile(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from('user_profiles').upsert(
    { id: userId, role: OWNER_ROLE, is_active: true, permissions: {} },
    { onConflict: 'id' }
  )
  if (error) throw error
}

async function claimLead(admin: SupabaseClient, leadId: string, userId: string): Promise<void> {
  const claimedAt = new Date().toISOString()
  const { error } = await admin
    .from('leads')
    .update({ auth_user_id: userId, claimed_at: claimedAt })
    .eq('id', leadId)
    .is('auth_user_id', null)
  if (error) {
    logger.warn('No se pudo reclamar lead en provision', { leadId, error: error.message })
  }
}

/**
 * Crea o resuelve el auth user + perfil owner. Devuelve action_link (sin enviar correo).
 * generateLink no dispara el mail de Supabase: el caller manda el branded email.
 */
export async function provisionOwnerAccess(
  admin: SupabaseClient,
  input: { email: string; leadId?: string; businessName?: string | null }
): Promise<ProvisionOwnerResult> {
  const email = input.email
  const redirectTo = ownerRedirectTo()

  let created = true
  let generated = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: { role: OWNER_ROLE } },
  })

  if (generated.error || !generated.data.user) {
    created = false
    generated = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })
  }

  if (generated.error || !generated.data.user) {
    throw new Error(generated.error?.message || 'No se pudo provisionar el acceso del dueño')
  }

  const actionLink = generated.data.properties?.action_link
  if (!actionLink) throw new Error('Supabase no devolvió action_link')

  const userId = generated.data.user.id
  await upsertOwnerProfile(admin, userId)
  if (input.leadId) await claimLead(admin, input.leadId, userId)

  return { email, userId, actionLink, created }
}

/**
 * Invite desde ops (/admin). Provision + correo Resend (o enlace al portapapeles).
 */
export async function inviteOwnerAccess(
  admin: SupabaseClient,
  input: { email: string; businessName?: string | null; leadId?: string }
): Promise<InviteOwnerResult> {
  const provisioned = await provisionOwnerAccess(admin, input)

  const mailed = await sendOwnerAccessEmail({
    email: provisioned.email,
    actionLink: provisioned.actionLink,
    businessName: input.businessName,
  })

  if (mailed.ok) {
    return {
      email: provisioned.email,
      userId: provisioned.userId,
      channel: provisioned.created ? 'invite' : 'access_email',
      message: `Correo de acceso enviado a ${provisioned.email}.`,
    }
  }

  logger.warn('Invite owner sin Resend; enlace solo en respuesta ops', {
    email: provisioned.email,
    error: mailed.error,
  })

  return {
    email: provisioned.email,
    userId: provisioned.userId,
    channel: 'access_link',
    action_link: provisioned.actionLink,
    message:
      `Usuario listo. Copiá el enlace y enviáselo a ${provisioned.email} ` +
      `(configurá RESEND_API_KEY para enviarlo automático).`,
  }
}
