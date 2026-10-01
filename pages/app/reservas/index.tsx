import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../components/suite/SuiteShell'
import { suiteFetch } from '../../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'
import {
  SUITE_APPOINTMENTS_API,
  SUITE_BLOCKS_API,
  SUITE_EQUIPO_PATH,
  SUITE_INQUIRIES_API,
  SUITE_INQUIRIES_CONVERT_API,
  SUITE_SERVICES_API,
  SUITE_STAFF_API,
} from '../../../lib/suite/paths'
import { hondurasTodayDate } from '../../../lib/suite/schemas'
import { formatDateTimeForHonduras } from '../../../lib/timezone'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-500/30 border-amber-400/50',
  confirmed: 'bg-sky-500/30 border-sky-400/50',
  completed: 'bg-emerald-500/30 border-emerald-400/50',
  cancelled: 'bg-white/10 border-white/20',
  no_show: 'bg-rose-500/30 border-rose-400/50',
}

type Appointment = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  notes: string | null
  staff_id: string | null
  customers: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null
  staff_members: { name: string; color: string } | { name: string; color: string }[] | null
  bookable_services: { name: string } | { name: string }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'reservas' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function ReservasPage({ tenant }: { tenant: SuiteTenant }) {
  const router = useRouter()
  const [day, setDay] = useState(hondurasTodayDate())
  const [view, setView] = useState<'day' | 'week'>('day')
  const [rows, setRows] = useState<Appointment[]>([])
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [services, setServices] = useState<{ id: string; name: string; duration_min: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [inquiries, setInquiries] = useState<
    { id: string; full_name: string; phone: string | null; created_at: string }[]
  >([])
  const [showCreate, setShowCreate] = useState(false)
  const [showBlock, setShowBlock] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    staff_id: '',
    service_id: '',
    starts_at: `${hondurasTodayDate()}T09:00`,
    notes: '',
  })
  const [blockForm, setBlockForm] = useState({
    staff_id: '',
    starts_at: `${hondurasTodayDate()}T12:00`,
    ends_at: `${hondurasTodayDate()}T13:00`,
    reason: 'Almuerzo',
  })

  const range = useMemo(() => {
    const start = new Date(`${day}T00:00:00-06:00`)
    const days = view === 'week' ? 7 : 1
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
    return { from: start.toISOString(), to: end.toISOString() }
  }, [day, view])

  const load = useCallback(async () => {
    try {
      const [aRes, sRes, svcRes, inqRes] = await Promise.all([
        suiteFetch(`${SUITE_APPOINTMENTS_API}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`),
        suiteFetch(SUITE_STAFF_API),
        suiteFetch(SUITE_SERVICES_API),
        suiteFetch(SUITE_INQUIRIES_API),
      ])
      const aBody = (await aRes.json()) as { appointments?: Appointment[]; error?: string }
      if (!aRes.ok) throw new Error(aBody.error || 'No se pudieron cargar citas')
      setRows(aBody.appointments ?? [])
      const sBody = (await sRes.json()) as { staff?: { id: string; name: string }[] }
      setStaff(sBody.staff ?? [])
      const svcBody = (await svcRes.json()) as { services?: { id: string; name: string; duration_min: number }[] }
      setServices(svcBody.services ?? [])
      if (inqRes.ok) {
        const inqBody = (await inqRes.json()) as {
          inquiries?: { id: string; full_name: string; phone: string | null; created_at: string }[]
        }
        setInquiries(inqBody.inquiries ?? [])
      }
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (router.query.new === '1') setShowCreate(true)
    if (router.query.block === '1') setShowBlock(true)
  }, [router.query.new, router.query.block])

  async function createAppointment() {
    try {
      const starts = new Date(`${form.starts_at}:00-06:00`).toISOString()
      const res = await suiteFetch(SUITE_APPOINTMENTS_API, {
        method: 'POST',
        body: JSON.stringify({
          customer_name: form.customer_name,
          customer_phone: form.customer_phone || null,
          staff_id: form.staff_id || null,
          service_id: form.service_id || null,
          starts_at: starts,
          source: 'walk_in',
          notes: form.notes || null,
        }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo crear')
      setNotice('Cita creada')
      setShowCreate(false)
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function createBlock() {
    try {
      const res = await suiteFetch(SUITE_BLOCKS_API, {
        method: 'POST',
        body: JSON.stringify({
          staff_id: blockForm.staff_id || null,
          starts_at: new Date(`${blockForm.starts_at}:00-06:00`).toISOString(),
          ends_at: new Date(`${blockForm.ends_at}:00-06:00`).toISOString(),
          reason: blockForm.reason,
        }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo bloquear')
      setNotice('Horario bloqueado')
      setShowBlock(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function convertInquiry(id: string) {
    const starts = new Date(`${day}T10:00:00-06:00`).toISOString()
    const res = await suiteFetch(SUITE_INQUIRIES_CONVERT_API, {
      method: 'POST',
      body: JSON.stringify({ inquiry_id: id, starts_at: starts }),
    })
    const body = (await res.json()) as { error?: string }
    if (!res.ok) {
      setError(body.error || 'No se pudo convertir')
      return
    }
    setNotice('Solicitud convertida a cita (10:00)')
    void load()
  }

  async function patchStatus(id: string, status: string) {
    const res = await suiteFetch(SUITE_APPOINTMENTS_API, {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      setError(body.error || 'No se pudo actualizar')
      return
    }
    void load()
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Agenda · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Agenda</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={SUITE_EQUIPO_PATH} className="text-sky-200 hover:underline">
              Equipo
            </Link>
            <button type="button" className="text-sky-200 hover:underline" onClick={() => setShowCreate(true)}>
              Nueva cita
            </button>
            <button type="button" className="text-sky-200 hover:underline" onClick={() => setShowBlock(true)}>
              Bloquear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            className="rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${view === 'day' ? 'bg-sky-500/30' : 'bg-white/5'}`}
            onClick={() => setView('day')}
          >
            Día
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${view === 'week' ? 'bg-sky-500/30' : 'bg-white/5'}`}
            onClick={() => setView('week')}
          >
            Semana
          </button>
        </div>

        {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {inquiries.length > 0 ? (
          <section className="space-y-2 rounded border border-amber-400/30 bg-amber-500/5 p-3">
            <h2 className="text-sm font-semibold">Solicitudes web sin convertir</h2>
            <ul className="space-y-2">
              {inquiries.map((inq) => (
                <li key={inq.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {inq.full_name}
                    {inq.phone ? ` · ${inq.phone}` : ''}
                  </span>
                  <button
                    type="button"
                    className="text-sky-200 underline"
                    onClick={() => void convertInquiry(inq.id)}
                  >
                    Convertir a cita
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ul className="space-y-2">
          {rows.length === 0 ? <li className="text-sm text-white/50">Sin citas en este rango.</li> : null}
          {rows.map((row) => {
            const customer = one(row.customers)
            const member = one(row.staff_members)
            const service = one(row.bookable_services)
            return (
              <li
                key={row.id}
                className={`rounded border px-3 py-3 text-sm ${STATUS_COLOR[row.status] || STATUS_COLOR.confirmed}`}
                style={member?.color ? { borderLeftWidth: 4, borderLeftColor: member.color } : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{customer?.name || 'Sin nombre'}</p>
                  <p className="text-xs uppercase tracking-wide">{row.status}</p>
                </div>
                <p className="text-white/70">
                  {formatDateTimeForHonduras(row.starts_at)} → {formatDateTimeForHonduras(row.ends_at)}
                </p>
                <p className="text-xs text-white/50">
                  {[member?.name, service?.name, customer?.phone].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {['confirmed', 'completed', 'cancelled', 'no_show'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="underline opacity-80 hover:opacity-100"
                      onClick={() => void patchStatus(row.id, status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>

        {showCreate ? (
          <Modal title="Crear cita" onClose={() => setShowCreate(false)}>
            <label className="block text-xs">
              Cliente
              <input
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
            </label>
            <label className="block text-xs">
              WhatsApp
              <input
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={form.customer_phone}
                onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
              />
            </label>
            <label className="block text-xs">
              Inicio
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              />
            </label>
            <label className="block text-xs">
              Staff
              <select
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={form.staff_id}
                onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
              >
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Servicio
              <select
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={form.service_id}
                onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))}
              >
                <option value="">Sin servicio</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded bg-sky-500/30 px-3 py-2 text-sm"
              onClick={() => void createAppointment()}
            >
              Guardar
            </button>
          </Modal>
        ) : null}

        {showBlock ? (
          <Modal title="Bloquear horario" onClose={() => setShowBlock(false)}>
            <label className="block text-xs">
              Desde
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={blockForm.starts_at}
                onChange={(e) => setBlockForm((f) => ({ ...f, starts_at: e.target.value }))}
              />
            </label>
            <label className="block text-xs">
              Hasta
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={blockForm.ends_at}
                onChange={(e) => setBlockForm((f) => ({ ...f, ends_at: e.target.value }))}
              />
            </label>
            <label className="block text-xs">
              Motivo
              <input
                className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1"
                value={blockForm.reason}
                onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
            <button type="button" className="rounded bg-sky-500/30 px-3 py-2 text-sm" onClick={() => void createBlock()}>
              Bloquear
            </button>
          </Modal>
        ) : null}
      </div>
    </SuiteShell>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-3 rounded border border-white/20 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-white/50">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
