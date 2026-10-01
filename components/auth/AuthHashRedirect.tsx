import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Supabase a veces deja tokens o errores en /#access_token=... / /#error=...
 * cuando el Site URL es la raíz. Enruta a update-password o login.
 */
export default function AuthHashRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const { hash, pathname } = window.location
    if (!hash || hash.length < 2) return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const error = params.get('error') || params.get('error_code')
    if (error) {
      if (pathname.startsWith('/app/login')) return
      void router.replace('/app/login?error=link_expired')
      return
    }

    if (!params.get('access_token') && !hash.includes('access_token')) return
    if (pathname.startsWith('/auth/update-password')) return

    const target = `/auth/update-password?next=${encodeURIComponent('/app/login')}${hash}`
    void router.replace(target)
  }, [router])

  return null
}
