import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireSuperAdmin } from '../../../../lib/auth/api-auth'
import { SUPER_ADMIN_ROLE } from '../../../../lib/auth/role-access'
import { createAdminClient } from '../../../../lib/supabase/admin'

const patchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requireSuperAdmin(
    req,
    res,
    req.method === 'PATCH' ? 'users_patch' : 'users_list'
  )
  if (!actor) return

  try {
    const db = createAdminClient()

    if (req.method === 'GET') {
      const { data: profiles, error } = await db
        .from('user_profiles')
        .select('id, role, is_active, created_at, updated_at')
        .eq('role', SUPER_ADMIN_ROLE)
        .order('created_at', { ascending: true })
      if (error) throw error

      const users = await Promise.all(
        (profiles ?? []).map(async (profile) => {
          const { data } = await db.auth.admin.getUserById(profile.id)
          return {
            id: profile.id,
            email: (data.user?.email || '').toLowerCase(),
            role: profile.role,
            is_active: profile.is_active,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
          }
        })
      )
      return res.status(200).json({ users })
    }

    if (req.method === 'PATCH') {
      const parsed = patchSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      if (parsed.data.id === actor.user.id && parsed.data.is_active === false) {
        return res.status(400).json({ error: 'No podés desactivarte a vos mismo' })
      }

      const { data, error } = await db
        .from('user_profiles')
        .update({ is_active: parsed.data.is_active })
        .eq('id', parsed.data.id)
        .eq('role', SUPER_ADMIN_ROLE)
        .select('id, role, is_active, created_at, updated_at')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Operador no encontrado' })

      const { data: authUser } = await db.auth.admin.getUserById(data.id)
      return res.status(200).json({
        user: {
          id: data.id,
          email: (authUser.user?.email || '').toLowerCase(),
          role: data.role,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
      })
    }

    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron gestionar operadores'
    return res.status(500).json({ error: message })
  }
}
