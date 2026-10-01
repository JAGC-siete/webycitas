import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import OpsShell from '../../components/ops/OpsShell'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { requireSuperAdminPage } from '../../lib/auth/api-auth'
import { opsFetch } from '../../lib/auth/client-session'
import { OPS_ADMIN_SITES_API_PATH } from '../../lib/ops/paths'
import { formatDateTimeForHonduras } from '../../lib/timezone'

interface SiteRow {
  id: string
  title: string
  slug: string
  template_type: string
  status: string
  published_at: string | null
  created_at: string
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuperAdminPage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: { operatorEmail: auth.actor.email } }
}

export default function OpsSitesPage({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<SiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await opsFetch(OPS_ADMIN_SITES_API_PATH)
      const body = (await res.json().catch(() => ({}))) as { sites?: SiteRow[]; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar los sites')
      setRows(body.sites ?? [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los sites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OpsShell operatorEmail={operatorEmail}>
      <Head>
        <title>Sites · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Sites</h1>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {loading ? <p className="text-sm text-white/60">Cargando…</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm text-white/60">Sin sites.</p> : null}
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card variant="glass">
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{row.title}</p>
                    <Badge variant="secondary">{row.status}</Badge>
                  </div>
                  <p className="text-sm text-white/70">{row.template_type}</p>
                  <Link href={`/p/${row.slug}`} className="text-sm text-sky-200 hover:underline">
                    /p/{row.slug}
                  </Link>
                  <p className="text-xs text-white/50">
                    {row.published_at
                      ? `Publicado ${formatDateTimeForHonduras(row.published_at)}`
                      : `Creado ${formatDateTimeForHonduras(row.created_at)}`}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </OpsShell>
  )
}
