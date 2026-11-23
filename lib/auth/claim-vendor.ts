import type { SupabaseClient } from '@supabase/supabase-js'
import { VENDORS_TABLE } from '../mercado/schema'
import { normalizeEmail } from './credentials'
import { VENDOR_ROLE } from './role-access'

export type ClaimedVendor = {
  id: string
  status: string
  contact_email: string | null
  auth_user_id: string | null
}

/**
 * Directory twin of resolveOwnerLead: the listing already linked to this user, or the
 * active, unclaimed listing whose contact_email matches (claimed on the spot).
 */
export async function resolveOrClaimVendor(
  admin: SupabaseClient,
  input: { userId: string; email: string }
): Promise<ClaimedVendor | null> {
  const { data: linked } = await admin
    .from(VENDORS_TABLE)
    .select('id, status, contact_email, auth_user_id')
    .eq('auth_user_id', input.userId)
    .maybeSingle()

  if (linked) {
    if (linked.status === 'inactive') return null
    return linked as ClaimedVendor
  }

  const email = normalizeEmail(input.email)
  if (!email) return null

  const { data: byEmail } = await admin
    .from(VENDORS_TABLE)
    .select('id, status, contact_email, auth_user_id')
    .eq('status', 'active')
    .is('auth_user_id', null)
    .ilike('contact_email', email)
    .maybeSingle()

  if (!byEmail) return null

  const { data: claimed, error } = await admin
    .from(VENDORS_TABLE)
    .update({ auth_user_id: input.userId, claimed_at: new Date().toISOString() })
    .eq('id', byEmail.id)
    .is('auth_user_id', null)
    .select('id, status, contact_email, auth_user_id')
    .maybeSingle()

  if (error || !claimed) return null
  return claimed as ClaimedVendor
}

export type EnsureVendorProfileResult = { ok: true } | { ok: false; existingRole: string }

/**
 * Creates the vendor profile only when the user has none. Never changes an existing
 * profile: the same email could belong to a Webycitas owner or to a super_admin, and
 * rewriting their role would lock them out of what they already use.
 */
export async function ensureVendorProfile(admin: SupabaseClient, userId: string): Promise<EnsureVendorProfileResult> {
  const { data: existing, error: readError } = await admin
    .from('site_user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (existing) {
    return existing.role === VENDOR_ROLE ? { ok: true } : { ok: false, existingRole: String(existing.role) }
  }

  const { error } = await admin.from('site_user_profiles').upsert(
    { id: userId, role: VENDOR_ROLE, is_active: true, permissions: {} },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  if (error) throw error
  return { ok: true }
}
