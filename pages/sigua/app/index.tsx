import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { signOutClient } from '../../../lib/auth/client-session'
import { requireVendorPage } from '../../../lib/mercado/page-auth'
import { APP_LOGIN_PATH, MERCADO_ADMIN_PATH, mercadoHomePath } from '../../../lib/mercado/paths'

type Props = {
  email: string | null
  role: string
}

export default function AppHomePage({ email, role }: Props) {
  async function logout() {
    try {
      await signOutClient()
    } finally {
      window.location.href = APP_LOGIN_PATH
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Head>
        <title>Mi negocio · Mercado Digital de Siguatepeque</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Card variant="glass" className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg text-white">Portal de tu negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-200">
          <p>
            Sesión: <span className="text-white">{email || 'sin correo'}</span> ({role})
          </p>
          <p>
            El editor de tu ficha todavía no está disponible aquí. Mientras tanto puedes ver el
            directorio público.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={mercadoHomePath()}>Ver directorio</Link>
            </Button>
            {role === 'super_admin' ? (
              <Button asChild variant="outline">
                <Link href={MERCADO_ADMIN_PATH}>Ir a fichas</Link>
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void logout()}>
              Salir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const auth = await requireVendorPage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return {
    props: {
      email: auth.email,
      role: auth.role,
    },
  }
}
