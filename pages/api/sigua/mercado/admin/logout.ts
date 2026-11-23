import type { NextApiRequest, NextApiResponse } from 'next'
import { mercadoAdminClearCookie } from '../../../../../lib/mercado/admin-auth'
import { createMercadoServerClient } from '../../../../../lib/sigua/supabase/server'

/** Corte HMAC: limpia mercado_op y sesión Supabase si existe. Preferí POST /api/auth/logout. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  try {
    const supabase = createMercadoServerClient(req, res)
    await supabase.auth.signOut()
  } catch {
    // best-effort
  }
  mercadoAdminClearCookie(res)
  return res.status(200).json({ ok: true })
}
