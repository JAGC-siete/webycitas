import { useEffect } from 'react'
import { parseAuthHash, updatePasswordHashTarget } from '../../lib/auth/auth-hash'

/**
 * Supabase a veces deja tokens o errores en /#access_token=... / /#error=...
 * cuando el Site URL es la raíz. Enruta a update-password o login.
 * Usa window.location.replace para no perder el hash (Next router lo descarta).
 */
export default function AuthHashRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const { hash, pathname } = window.location
    if (!hash || hash.length < 2) return

    const { error, hasAccessToken } = parseAuthHash(hash)
    if (error) {
      if (pathname.startsWith('/app/login')) return
      window.location.replace('/app/login?error=link_expired')
      return
    }

    if (!hasAccessToken) return
    if (pathname.startsWith('/auth/update-password')) return

    window.location.replace(updatePasswordHashTarget(hash, '/app/login'))
  }, [])

  return null
}
