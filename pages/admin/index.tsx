import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import OpsShell from '../../components/ops/OpsShell'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { requireSuperAdminPage } from '../../lib/auth/api-auth'
import { opsFetch } from '../../lib/auth/client-session'
import {
  OPS_ADMIN_INVITE_API_PATH,
  OPS_ADMIN_LEADS_API_PATH,
  OPS_ADMIN_METRICS_API_PATH,
} from '../../lib/ops/paths'
import { formatDateTimeForHonduras } from '../../lib/timezone'

type LeadStatus = 'received' | 'reviewed' | 'rejected'

interface LeadRow {
  id: string
  owner_name: string
  business_name: string
  email: string
  phone: string
  rubro: string
  city: string
  services: string[]
  status: LeadStatus
  preview_slug: string | null
  created_at: string
}

interface MetricsPayload {
  leads: { received: number; reviewed: number; rejected: number; total: number }
  sites: { total: number }
  inquiries: { last_7d: number }
  owners_active: number
}

const STATUSES: LeadStatus[] = ['received', 'reviewed', 'rejected']

const STATUS_LABEL: Record<LeadStatus, string> = {
  received: 'Recibido',
  reviewed: 'Revisado',
  rejected: 'Descartado',
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuperAdminPage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: { operatorEmail: auth.actor.email } }
}

export default function OpsLeadsPage({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<LeadRow[]>([])
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [leadsRes, metricsRes] = await Promise.all([
        opsFetch(OPS_ADMIN_LEADS_API_PATH),
        opsFetch(OPS_ADMIN_METRICS_API_PATH),
      ])
      const leadsBody = (await leadsRes.json().catch(() => ({}))) as { leads?: LeadRow[]; error?: string }
      if (!leadsRes.ok) throw new Error(leadsBody.error || 'No se pudieron cargar los leads')
      setRows(leadsBody.leads ?? [])

      if (metricsRes.ok) {
        const metricsBody = (await metricsRes.json().catch(() => null)) as MetricsPayload | null
        if (metricsBody) setMetrics(metricsBody)
      }
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function inviteOwner(id: string) {
    setInvitingId(id)
    try {
      const res = await opsFetch(OPS_ADMIN_INVITE_API_PATH, {
        method: 'POST',
        body: JSON.stringify({ lead_id: id }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; email?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo invitar')
      setError(null)
      setNotice(`Invitación enviada a ${body.email || 'el lead'}`)
    } catch (err: unknown) {
      setNotice(null)
      setError(err instanceof Error ? err.message : 'No se pudo invitar')
    } finally {
      setInvitingId(null)
    }
  }

  async function patchStatus(id: string, status: LeadStatus) {
    if (status === 'rejected') {
      const ok = window.confirm('¿Descartar este lead? El owner no podrá entrar al panel.')
      if (!ok) return
    }
    setSavingId(id)
    try {
      const res = await opsFetch(OPS_ADMIN_LEADS_API_PATH, {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo actualizar')
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)))
      setError(null)
      setNotice(`Estado actualizado a ${STATUS_LABEL[status]}`)
      void load()
    } catch (err: unknown) {
      setNotice(null)
      setError(err instanceof Error ? err.message : 'No se pudo actualizar')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <OpsShell operatorEmail={operatorEmail}>
      <Head>
        <title>Leads · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        {metrics ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard label="Recibidos" value={metrics.leads.received} />
            <MetricCard label="Revisados" value={metrics.leads.reviewed} />
            <MetricCard label="Descartados" value={metrics.leads.rejected} />
            <MetricCard label="Sites" value={metrics.sites.total} />
            <MetricCard label="Consultas 7d" value={metrics.inquiries.last_7d} />
          </div>
        ) : null}
        {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {loading ? <p className="text-sm text-white/60">Cargando…</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm text-white/60">Sin leads.</p> : null}
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card variant="glass">
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{row.business_name}</p>
                    <Badge variant="secondary">{STATUS_LABEL[row.status]}</Badge>
                  </div>
                  <p className="text-sm text-white/70">
                    {row.owner_name} · {row.city} · {row.rubro}
                  </p>
                  <p className="text-sm text-white/70">
                    {row.email} · {row.phone}
                  </p>
                  <p className="text-xs text-white/50">
                    {row.services.join(', ')} · {formatDateTimeForHonduras(row.created_at)}
                  </p>
                  {row.preview_slug ? (
                    <Link href={`/p/${row.preview_slug}`} className="text-sm text-sky-200 hover:underline">
                      /p/{row.preview_slug}
                    </Link>
                  ) : null}
                  <label className="block text-xs text-white/50">
                    Estado
                    <select
                      className="mt-1 block rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm text-white"
                      value={row.status}
                      disabled={savingId === row.id}
                      onChange={(event) => void patchStatus(row.id, event.target.value as LeadStatus)}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {row.status !== 'rejected' ? (
                    <button
                      type="button"
                      className="text-sm text-sky-200 hover:underline disabled:text-white/40"
                      disabled={invitingId === row.id}
                      onClick={() => void inviteOwner(row.id)}
                    >
                      {invitingId === row.id ? 'Invitando…' : 'Invitar al panel'}
                    </button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </OpsShell>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-white/10 bg-slate-900/60 px-3 py-2">
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
