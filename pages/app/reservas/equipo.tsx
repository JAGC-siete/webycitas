import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../components/suite/SuiteShell'
import { suiteFetch } from '../../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'
import { SUITE_SERVICES_API, SUITE_STAFF_API } from '../../../lib/suite/paths'

type StaffRow = {
  id: string
  name: string
  color: string
  is_active: boolean
  bio: string | null
  staff_schedules: { weekday: number; start_time: string; end_time: string }[]
  staff_services: { service_id: string }[]
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'reservas' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function EquipoPage({ tenant }: { tenant: SuiteTenant }) {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [sRes, svcRes] = await Promise.all([suiteFetch(SUITE_STAFF_API), suiteFetch(SUITE_SERVICES_API)])
    const sBody = (await sRes.json()) as { staff?: StaffRow[]; error?: string }
    if (!sRes.ok) {
      setError(sBody.error || 'No se pudo cargar el equipo')
      return
    }
    setRows(sBody.staff ?? [])
    const svcBody = (await svcRes.json()) as { services?: { id: string; name: string }[] }
    setServices(svcBody.services ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addMember() {
    if (!name.trim()) return
    const res = await suiteFetch(SUITE_STAFF_API, {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        schedules: [
          { weekday: 1, start_time: '08:00', end_time: '17:00' },
          { weekday: 2, start_time: '08:00', end_time: '17:00' },
          { weekday: 3, start_time: '08:00', end_time: '17:00' },
          { weekday: 4, start_time: '08:00', end_time: '17:00' },
          { weekday: 5, start_time: '08:00', end_time: '17:00' },
          { weekday: 6, start_time: '08:00', end_time: '14:00' },
        ],
      }),
    })
    const body = (await res.json()) as { error?: string }
    if (!res.ok) {
      setError(body.error || 'No se pudo crear')
      return
    }
    setName('')
    setNotice('Miembro agregado')
    void load()
  }

  async function toggleActive(row: StaffRow) {
    const res = await suiteFetch(SUITE_STAFF_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: row.id, is_active: !row.is_active }),
    })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      setError(body.error || 'No se pudo actualizar')
      return
    }
    void load()
  }

  async function linkAllServices(row: StaffRow) {
    const res = await suiteFetch(SUITE_STAFF_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: row.id, service_ids: services.map((s) => s.id) }),
    })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      setError(body.error || 'No se pudo vincular')
      return
    }
    setNotice(`Servicios asignados a ${row.name}`)
    void load()
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Equipo · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Equipo</h1>
        {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm"
            placeholder="Nombre (ej. Carlos)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="rounded bg-sky-500/30 px-3 py-1 text-sm" onClick={() => void addMember()}>
            Agregar
          </button>
        </div>

        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded border border-white/10 bg-slate-900/50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: row.color }} />
                  <p className="font-medium">{row.name}</p>
                  <span className="text-xs text-white/40">{row.is_active ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <button type="button" className="underline" onClick={() => void toggleActive(row)}>
                    {row.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" className="underline" onClick={() => void linkAllServices(row)}>
                    Asignar todos los servicios
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-white/50">
                Horarios: {(row.staff_schedules ?? []).length} franjas · Servicios:{' '}
                {(row.staff_services ?? []).length}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </SuiteShell>
  )
}
