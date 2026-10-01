import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { signOutClient } from '../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../lib/suite/tenant'
import { SUITE_MODULES } from '../../lib/suite/modules'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function SuiteHomePage({ tenant }: { tenant: SuiteTenant }) {
  const router = useRouter()

  async function logout() {
    await signOutClient()
    void router.replace('/app/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Head>
        <title>Panel · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <header className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold">{tenant.businessName}</p>
            <p className="text-xs text-white/50">{tenant.email}</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => void logout()}>
            Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Tu panel</h1>
        <p className="text-sm text-white/70">
          El constructor, reservas e inventario se habilitan cuando el módulo esté listo.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SUITE_MODULES.filter((module) => tenant.modules.includes(module.key)).map((module) => (
            <li key={module.key}>
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="text-lg">{module.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/70">{module.description}</p>
                  <p className="mt-2 text-xs text-white/40">Próximamente</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
