import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import OpsShell from '../../components/ops/OpsShell'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { requireSuperAdminPage } from '../../lib/auth/api-auth'
import { OPS_ADMIN_INVITE_API_PATH, OPS_ADMIN_LEADS_API_PATH } from '../../lib/ops/paths'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(OPS_ADMIN_LEADS_API_PATH, { credentials: 'include' })
      const body = (await res.json().catch(() => ({}))) as { leads?: LeadRow[]; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar los leads')
      setRows(body.leads ?? [])
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
      const res = await fetch(OPS_ADMIN_INVITE_API_PATH, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo invitar')
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo invitar')
    } finally {
      setInvitingId(null)
    }
  }

  async function patchStatus(id: string, status: LeadStatus) {
    setSavingId(id)
    try {
      const res = await fetch(OPS_ADMIN_LEADS_API_PATH, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo actualizar')
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)))
      setError(null)
    } catch (err: unknown) {
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
