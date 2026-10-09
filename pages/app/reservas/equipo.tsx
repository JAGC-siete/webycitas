import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import Notices from '../../../components/suite/Notices'
import SuiteShell from '../../../components/suite/SuiteShell'
import { useNotice } from '../../../components/suite/useNotice'
import { Button } from '../../../components/ui/button'
import { summarizeSchedules } from '../../../lib/suite/agenda'
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
  const { notice, error, succeed, fail } = useNotice()

  const load = useCallback(async () => {
    const [sRes, svcRes] = await Promise.all([suiteFetch(SUITE_STAFF_API), suiteFetch(SUITE_SERVICES_API)])
    const sBody = (await sRes.json()) as { staff?: StaffRow[]; error?: string }
    if (!sRes.ok) {
      fail(sBody.error || 'No se pudo cargar el equipo')
      return
    }
    setRows(sBody.staff ?? [])
    const svcBody = (await svcRes.json()) as { services?: { id: string; name: string }[] }
    setServices(svcBody.services ?? [])
  }, [fail])

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
      fail(body.error || 'No se pudo agregar a la persona')
      return
    }
    setName('')
    succeed(`${name.trim()} agregado al equipo, con horario de lunes a sábado.`)
    void load()
  }

  async function toggleActive(row: StaffRow) {
    const res = await suiteFetch(SUITE_STAFF_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: row.id, is_active: !row.is_active }),
    })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      fail(body.error || 'No se pudo actualizar')
      return
    }
    succeed(row.is_active ? `${row.name} ya no recibe reservas.` : `${row.name} vuelve a recibir reservas.`)
    void load()
  }

  async function linkAllServices(row: StaffRow) {
    const res = await suiteFetch(SUITE_STAFF_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: row.id, service_ids: services.map((s) => s.id) }),
    })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      fail(body.error || 'No se pudieron asignar los servicios')
      return
    }
    succeed(`${row.name} ahora puede atender todos los servicios.`)
    void load()
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Equipo · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold">Equipo y horarios</h1>
          <p className="text-sm text-white/60">
            Las personas que atienden y en qué horario se puede reservar con cada una.
          </p>
        </div>
        <Notices notice={notice} error={error} onRetry={error ? () => void load() : undefined} />

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void addMember()
          }}
        >
          <label className="block text-xs text-white/70">
            Agregar a alguien del equipo
            <input
              className="mt-1 block input-glass px-3 py-2 text-sm"
              placeholder="Nombre (ej. Carlos)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" className="h-10" disabled={!name.trim()}>
            Agregar
          </Button>
        </form>

        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="glass-modern rounded-xl px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: row.color }} />
                  <p className="font-medium">{row.name}</p>
                  <span className="text-xs text-white/50">{row.is_active ? 'Recibe reservas' : 'En pausa'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => void linkAllServices(row)}>
                    Asignar todos los servicios
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void toggleActive(row)}>
                    {row.is_active ? 'Pausar reservas' : 'Reactivar'}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/70">
                Horario: {summarizeSchedules(row.staff_schedules ?? [])}
              </p>
              <p className="text-xs text-white/50">
                Atiende {(row.staff_services ?? []).length} de {services.length} servicios
              </p>
            </li>
          ))}
        </ul>
      </div>
    </SuiteShell>
  )
}
