import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import OpsShell from '../../components/ops/OpsShell'
import { Card, CardContent } from '../../components/ui/card'
import { requireSuperAdminPage } from '../../lib/auth/api-auth'
import { OPS_ADMIN_INQUIRIES_API_PATH } from '../../lib/ops/paths'
import { formatDateTimeForHonduras } from '../../lib/timezone'

interface InquiryRow {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  message: string | null
  source: string
  created_at: string
  site: { slug: string; title: string } | null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuperAdminPage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: { operatorEmail: auth.actor.email } }
}

export default function OpsInquiriesPage({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<InquiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(OPS_ADMIN_INQUIRIES_API_PATH, { credentials: 'include' })
      const body = (await res.json().catch(() => ({}))) as { inquiries?: InquiryRow[]; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar las consultas')
      setRows(body.inquiries ?? [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las consultas')
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
        <title>Consultas · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Consultas</h1>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {loading ? <p className="text-sm text-white/60">Cargando…</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm text-white/60">Sin consultas.</p> : null}
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card variant="glass">
                <CardContent className="space-y-2 py-4">
                  <p className="font-medium">{row.full_name}</p>
                  <p className="text-sm text-white/70">
                    {[row.email, row.phone].filter(Boolean).join(' · ') || 'Sin contacto'}
                  </p>
                  {row.message ? <p className="text-sm text-white/80">{row.message}</p> : null}
                  {row.site ? (
                    <Link href={`/p/${row.site.slug}`} className="text-sm text-sky-200 hover:underline">
                      {row.site.title}
                    </Link>
                  ) : null}
                  <p className="text-xs text-white/50">
                    {row.source} · {formatDateTimeForHonduras(row.created_at)}
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
