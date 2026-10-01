import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { readStoredUser } from '../../lib/auth/client-session'
import { isSuperAdmin, loginPath } from '../../lib/auth/role-access'

export default function SuperAdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const stored = readStoredUser()
    if (!stored) {
      void router.replace(loginPath(router.asPath.split('?')[0]))
      return
    }
    if (!isSuperAdmin(stored)) {
      void router.replace('/app')
    }
  }, [router])

  return <>{children}</>
}
