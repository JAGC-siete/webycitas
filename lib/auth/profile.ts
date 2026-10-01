import { logger } from '../logger'
import { createAdminClient } from '../supabase/admin'
import { canLoginToApp, type AppRole, type UserProfileRow } from './role-access'

export async function loadProfile(userId: string): Promise<UserProfileRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_profiles')
    .select('id, role, is_active, permissions')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    logger.error('No se pudo leer user_profiles', { userId, error: error.message })
    return null
  }
  if (!data || !canLoginToApp(data)) return null
  return {
    id: data.id,
    role: data.role as AppRole,
    is_active: data.is_active,
    permissions: data.permissions ?? {},
  }
}
