import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../logger'

export async function resolveOwnerLead(
  admin: SupabaseClient,
  input: { userId: string; email: string }
): Promise<string | null> {
  const { data: linked, error: linkedError } = await admin
    .from('leads')
    .select('id, status')
    .eq('auth_user_id', input.userId)
    .maybeSingle()

  if (linkedError) {
    logger.error('No se pudo resolver lead por auth_user_id', { error: linkedError.message })
    return null
  }
  if (linked) {
    return linked.status === 'rejected' ? null : linked.id
  }

  const { data: candidates, error: emailError } = await admin
    .from('leads')
    .select('id, status')
    .eq('email', input.email)
    .neq('status', 'rejected')
    .is('auth_user_id', null)
    .order('created_at', { ascending: false })
    .limit(1)

  if (emailError) {
    logger.error('No se pudo resolver lead por email', { error: emailError.message })
    return null
  }

  const claimable = candidates?.[0]
  if (!claimable) return null

  const claimedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('leads')
    .update({ auth_user_id: input.userId, claimed_at: claimedAt })
    .eq('id', claimable.id)
    .is('auth_user_id', null)
    .select('id')
    .maybeSingle()

  if (claimError) {
    logger.error('No se pudo reclamar el lead', { leadId: claimable.id, error: claimError.message })
    return null
  }
  return claimed?.id ?? null
}
