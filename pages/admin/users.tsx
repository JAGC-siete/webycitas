import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import OpsShell from '../../components/ops/OpsShell'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { requireSuperAdminPage } from '../../lib/auth/api-auth'
import { opsFetch } from '../../lib/auth/client-session'
import { OPS_ADMIN_USERS_API_PATH } from '../../lib/ops/paths'
import { formatDateTimeForHonduras } from '../../lib/timezone'

interface OperatorRow {
  id: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuperAdminPage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: { operatorEmail: auth.actor.email, operatorId: auth.actor.user.id } }
}

export default function OpsUsersPage({
  operatorEmail,
  operatorId,
}: {
  operatorEmail: string
  operatorId: string
}) {
  const [rows, setRows] = useState<OperatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await opsFetch(OPS_ADMIN_USERS_API_PATH)
      const body = (await res.json().catch(() => ({}))) as { users?: OperatorRow[]; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar operadores')
      setRows(body.users ?? [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar operadores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleActive(row: OperatorRow) {
    const next = !row.is_active
    if (!next && row.id === operatorId) {
      setError('No podés desactivarte a vos mismo')
      return
    }
    if (!next) {
      const ok = window.confirm(`¿Desactivar a ${row.email || row.id}?`)
      if (!ok) return
    }
    setSavingId(row.id)
    try {
      const res = await opsFetch(OPS_ADMIN_USERS_API_PATH, {
        method: 'PATCH',
        body: JSON.stringify({ id: row.id, is_active: next }),
      })
      const body = (await res.json().catch(() => ({}))) as { user?: OperatorRow; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo actualizar')
      setRows((prev) => prev.map((item) => (item.id === row.id && body.user ? body.user : item)))
      setError(null)
      setNotice(next ? 'Operador reactivado' : 'Operador desactivado')
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
        <title>Operadores · Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Operadores</h1>
        {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {loading ? <p className="text-sm text-white/60">Cargando…</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm text-white/60">Sin operadores.</p> : null}
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card variant="glass">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{row.email || row.id}</p>
                    <p className="text-xs text-white/50">
                      Alta {formatDateTimeForHonduras(row.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{row.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    <button
                      type="button"
                      className="text-sm text-sky-200 hover:underline disabled:text-white/40"
                      disabled={savingId === row.id || (row.id === operatorId && row.is_active)}
                      onClick={() => void toggleActive(row)}
                    >
                      {savingId === row.id
                        ? 'Guardando…'
                        : row.is_active
                          ? 'Desactivar'
                          : 'Reactivar'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </OpsShell>
  )
}
