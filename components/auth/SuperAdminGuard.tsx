import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { isStoredSuperAdmin, readStoredUser } from '../../lib/auth/client-session'
import { loginPath } from '../../lib/auth/role-access'

export default function SuperAdminGuard({
  children,
  redirectPath = '/app',
}: {
  children: ReactNode
  /** Destino si hay sesión pero no es super_admin. */
  redirectPath?: string
}) {
  const router = useRouter()

  useEffect(() => {
    const stored = readStoredUser()
    if (!stored) {
      void router.replace(loginPath(router.asPath.split('?')[0]))
      return
    }
    if (!isStoredSuperAdmin(stored)) {
      void router.replace(redirectPath)
    }
  }, [router, redirectPath])

  return <>{children}</>
}
