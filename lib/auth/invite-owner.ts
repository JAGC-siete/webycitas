import type { SupabaseClient } from '@supabase/supabase-js'
import { emailCta, emailParagraph, escapeHtml, wrapEmail } from '../emails'
import { logger } from '../logger'
import { getResendFrom } from '../resend-from'
import { authRedirectOrigin } from '../site'
import {
  buildOwnerAccessUrl,
  isLocalAuthOrigin,
  ownerUpdatePasswordRedirectPath,
  type OwnerAccessLinkType,
} from './auth-hash'
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
  return `${authRedirectOrigin()}${ownerUpdatePasswordRedirectPath()}`
}

async function sendBrandedAccessEmail(input: {
  email: string
  actionLink: string
  title: string
  introHtml: string
  noteHtml: string
  ctaLabel: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY ausente' }

  const html = wrapEmail(
    input.title,
    [
      emailParagraph(input.introHtml),
      emailParagraph(input.noteHtml),
      emailCta(input.actionLink, input.ctaLabel),
    ].join('')
  )

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const sent = await resend.emails.send({
    from: getResendFrom(),
    to: input.email,
    subject: input.title,
    html,
  })
  if (sent.error) return { ok: false, error: sent.error.message }
  return { ok: true }
}

async function sendOwnerAccessEmail(input: {
  email: string
  actionLink: string
  businessName?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const intro = input.businessName
    ? `Creá tu contraseña para administrar <strong>${escapeHtml(input.businessName)}</strong>.`
    : 'Creá tu contraseña para administrar tu sitio y tus citas.'
  return sendBrandedAccessEmail({
    email: input.email,
    actionLink: input.actionLink,
    title: 'Acceso a tu panel Webycitas',
    introHtml: intro,
    noteHtml: 'Este enlace es de un solo uso. Si expiró, pedí otra invitación al operador o usá “Olvidé mi contraseña”.',
    ctaLabel: 'Crear contraseña y entrar',
  })
}

async function sendRecoveryAccessEmail(input: {
  email: string
  actionLink: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return sendBrandedAccessEmail({
    email: input.email,
    actionLink: input.actionLink,
    title: 'Restablecé tu contraseña · Webycitas',
    introHtml: 'Elegí una contraseña nueva para entrar a tu panel.',
    noteHtml: 'Este enlace es de un solo uso. Si expiró, volvé a pedir “Olvidé mi contraseña” en el login.',
    ctaLabel: 'Crear contraseña y entrar',
  })
}

/**
 * Crea el perfil owner solo si el usuario no tiene perfil. Nunca toca role ni
 * is_active de uno existente: el magnet y forgot-password son públicos y llegan
 * acá con cualquier correo (incluido el de un super_admin o un owner desactivado).
 */
export async function ensureOwnerProfile(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from('user_profiles').upsert(
    { id: userId, role: OWNER_ROLE, is_active: true, permissions: {} },
    { onConflict: 'id', ignoreDuplicates: true }
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
 *
 * El enlace del mail apunta a NUESTRA app con token_hash (no a /auth/v1/verify).
 * Así los scanners de correo no consumen el OTP al hacer GET del verify de Supabase.
 */
export async function provisionOwnerAccess(
  admin: SupabaseClient,
  input: { email: string; leadId?: string; businessName?: string | null }
): Promise<ProvisionOwnerResult> {
  const email = input.email
  const origin = authRedirectOrigin()
  if (process.env.NODE_ENV === 'production' && isLocalAuthOrigin(origin)) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL apunta a localhost en producción. Configurá https://webycitas.humanosisu.net en Railway.'
    )
  }

  const redirectTo = ownerRedirectTo()

  let linkType: OwnerAccessLinkType = 'invite'
  let created = true
  let generated = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: { role: OWNER_ROLE } },
  })

  if (generated.error || !generated.data.user) {
    created = false
    linkType = 'recovery'
    generated = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })
  }

  if (generated.error || !generated.data.user) {
    throw new Error(generated.error?.message || 'No se pudo provisionar el acceso del dueño')
  }

  const hashedToken = generated.data.properties?.hashed_token
  const fallbackLink = generated.data.properties?.action_link
  if (!hashedToken && !fallbackLink) {
    throw new Error('Supabase no devolvió hashed_token ni action_link')
  }

  const actionLink = hashedToken
    ? buildOwnerAccessUrl({ origin, tokenHash: hashedToken, type: linkType })
    : (fallbackLink as string)

  if (!hashedToken) {
    logger.warn('Invite sin hashed_token; se usa action_link (vulnerable a prefetch)', { email })
  }

  const userId = generated.data.user.id
  await ensureOwnerProfile(admin, userId)
  if (input.leadId) await claimLead(admin, input.leadId, userId)

  return { email, userId, actionLink, created }
}

/**
 * Recovery branded (forgot-password): generateLink + token_hash en nuestra app + Resend.
 * No usa resetPasswordForEmail (ese mail de Supabase se quema con prefetch).
 */
export async function sendOwnerPasswordReset(
  admin: SupabaseClient,
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const origin = authRedirectOrigin()
  if (process.env.NODE_ENV === 'production' && isLocalAuthOrigin(origin)) {
    return {
      ok: false,
      error:
        'NEXT_PUBLIC_SITE_URL apunta a localhost en producción. Configurá https://webycitas.humanosisu.net en Railway.',
    }
  }

  const redirectTo = ownerRedirectTo()
  const generated = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })
  if (generated.error || !generated.data.user) {
    return { ok: false, error: generated.error?.message || 'Usuario no encontrado' }
  }

  const hashedToken = generated.data.properties?.hashed_token
  const fallbackLink = generated.data.properties?.action_link
  if (!hashedToken && !fallbackLink) {
    return { ok: false, error: 'Supabase no devolvió hashed_token' }
  }

  const actionLink = hashedToken
    ? buildOwnerAccessUrl({ origin, tokenHash: hashedToken, type: 'recovery' })
    : (fallbackLink as string)

  if (!hashedToken) {
    logger.warn('Recovery sin hashed_token; se usa action_link (vulnerable a prefetch)', { email })
  }

  await ensureOwnerProfile(admin, generated.data.user.id)
  return sendRecoveryAccessEmail({ email, actionLink })
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
