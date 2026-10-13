import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { Ban, CalendarPlus, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react'
import Notices from '../../../components/suite/Notices'
import SuiteShell from '../../../components/suite/SuiteShell'
import { useNotice } from '../../../components/suite/useNotice'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { suiteFetch } from '../../../lib/auth/client-session'
import {
  groupAgendaByDay,
  hondurasLocalToIso,
  shiftDay,
  validateAppointmentForm,
  validateBlockForm,
  type FormErrors,
} from '../../../lib/suite/agenda'
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
import {
  APPOINTMENT_STATUS_COPY,
  appointmentStatusLabel,
  hondurasTodayDate,
  type AppointmentStatus,
} from '../../../lib/suite/schemas'
import {
  formatDateTimeForHonduras,
  formatDayHeadingForHonduras,
  formatTimeForHonduras,
} from '../../../lib/timezone'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-500/15 border-amber-400/40',
  confirmed: 'bg-sky-500/15 border-sky-400/40',
  completed: 'bg-emerald-500/15 border-emerald-400/40',
  cancelled: 'bg-white/5 border-white/15 opacity-70',
  no_show: 'bg-rose-500/15 border-rose-400/40',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-400/20 text-amber-100',
  confirmed: 'bg-sky-400/20 text-sky-100',
  completed: 'bg-emerald-400/20 text-emerald-100',
  cancelled: 'bg-white/10 text-white/70',
  no_show: 'bg-rose-400/20 text-rose-100',
}

type Appointment = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  source: string | null
  notes: string | null
  staff_id: string | null
  customers: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null
  staff_members: { name: string; color: string } | { name: string; color: string }[] | null
  bookable_services: { name: string } | { name: string }[] | null
}

type Block = {
  id: string
  staff_id: string | null
  starts_at: string
  ends_at: string
  reason: string | null
}

type Inquiry = { id: string; full_name: string; phone: string | null; created_at: string }

type AppointmentDialog = { kind: 'create' } | { kind: 'convert'; inquiry: Inquiry }

const fieldClass = 'mt-1 w-full input-glass px-3 py-2 text-sm'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  return `https://wa.me/${digits.length === 8 ? `504${digits}` : digits}`
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'reservas' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function ReservasPage({ tenant }: { tenant: SuiteTenant }) {
  const router = useRouter()
  const today = hondurasTodayDate()
  const [day, setDay] = useState(today)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [rows, setRows] = useState<Appointment[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [services, setServices] = useState<{ id: string; name: string; duration_min: number }[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { notice, error, succeed, fail } = useNotice()

  const [dialog, setDialog] = useState<AppointmentDialog | null>(null)
  const [showBlock, setShowBlock] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    staff_id: '',
    service_id: '',
    starts_at: `${today}T09:00`,
    notes: '',
  })
  const [formErrors, setFormErrors] = useState<FormErrors<'customer_name' | 'customer_phone' | 'starts_at'>>({})
  const [blockForm, setBlockForm] = useState({
    staff_id: '',
    starts_at: `${today}T12:00`,
    ends_at: `${today}T13:00`,
    reason: 'Almuerzo',
  })
  const [blockErrors, setBlockErrors] = useState<FormErrors<'starts_at' | 'ends_at'>>({})

  const range = useMemo(() => {
    const days = view === 'week' ? 7 : 1
    return {
      from: hondurasLocalToIso(`${day}T00:00`),
      to: hondurasLocalToIso(`${shiftDay(day, days)}T00:00`),
    }
  }, [day, view])

  const load = useCallback(async () => {
    try {
      const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      const [aRes, bRes, sRes, svcRes, inqRes] = await Promise.all([
        suiteFetch(`${SUITE_APPOINTMENTS_API}?${qs}`),
        suiteFetch(`${SUITE_BLOCKS_API}?${qs}`),
        suiteFetch(SUITE_STAFF_API),
        suiteFetch(SUITE_SERVICES_API),
        suiteFetch(SUITE_INQUIRIES_API),
      ])
      const aBody = (await aRes.json()) as { appointments?: Appointment[]; error?: string }
      if (!aRes.ok) throw new Error(aBody.error || 'No se pudieron cargar las citas')
      setRows(aBody.appointments ?? [])
      if (bRes.ok) {
        const bBody = (await bRes.json()) as { blocks?: Block[] }
        setBlocks(bBody.blocks ?? [])
      }
      const sBody = (await sRes.json()) as { staff?: { id: string; name: string }[] }
      setStaff(sBody.staff ?? [])
      const svcBody = (await svcRes.json()) as { services?: { id: string; name: string; duration_min: number }[] }
      setServices(svcBody.services ?? [])
      if (inqRes.ok) {
        const inqBody = (await inqRes.json()) as { inquiries?: Inquiry[] }
        setInquiries(inqBody.inquiries ?? [])
      }
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudo cargar la agenda')
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to, fail])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = useCallback(() => {
    setForm((f) => ({ ...f, customer_name: '', customer_phone: '', notes: '', starts_at: `${day}T09:00` }))
    setFormErrors({})
    setDialog({ kind: 'create' })
  }, [day])

  const openBlock = useCallback(() => {
    setBlockForm((f) => ({ ...f, starts_at: `${day}T12:00`, ends_at: `${day}T13:00` }))
    setBlockErrors({})
    setShowBlock(true)
  }, [day])

  useEffect(() => {
    if (router.query.new === '1') openCreate()
    if (router.query.block === '1') openBlock()
    // Solo al llegar desde el Panel con ?new=1 / ?block=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.new, router.query.block])

  function clearQuery() {
    if (router.query.new || router.query.block) {
      void router.replace({ pathname: router.pathname }, undefined, { shallow: true })
    }
  }

  function closeDialog() {
    setDialog(null)
    clearQuery()
  }

  function closeBlock() {
    setShowBlock(false)
    clearQuery()
  }

  function openConvert(inquiry: Inquiry) {
    setForm((f) => ({
      ...f,
      customer_name: inquiry.full_name,
      customer_phone: inquiry.phone ?? '',
      notes: '',
      starts_at: `${day}T10:00`,
    }))
    setFormErrors({})
    setDialog({ kind: 'convert', inquiry })
  }

  async function saveAppointment() {
    if (!dialog) return
    const errors = validateAppointmentForm(form, { contact: dialog.kind === 'create' })
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      const starts_at = hondurasLocalToIso(form.starts_at)
      const res =
        dialog.kind === 'convert'
          ? await suiteFetch(SUITE_INQUIRIES_CONVERT_API, {
              method: 'POST',
              body: JSON.stringify({
                inquiry_id: dialog.inquiry.id,
                starts_at,
                staff_id: form.staff_id || null,
                service_id: form.service_id || null,
              }),
            })
          : await suiteFetch(SUITE_APPOINTMENTS_API, {
              method: 'POST',
              body: JSON.stringify({
                customer_name: form.customer_name.trim(),
                customer_phone: form.customer_phone.trim() || null,
                staff_id: form.staff_id || null,
                service_id: form.service_id || null,
                starts_at,
                source: 'walk_in',
                notes: form.notes.trim() || null,
              }),
            })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo guardar la cita')
      succeed(
        dialog.kind === 'convert'
          ? `Cita agendada para ${form.customer_name} el ${formatDateTimeForHonduras(starts_at)}.`
          : 'Cita creada.'
      )
      closeDialog()
      setDay(form.starts_at.slice(0, 10))
      void load()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudo guardar la cita')
    } finally {
      setSaving(false)
    }
  }

  async function saveBlock() {
    const errors = validateBlockForm(blockForm)
    setBlockErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      const res = await suiteFetch(SUITE_BLOCKS_API, {
        method: 'POST',
        body: JSON.stringify({
          staff_id: blockForm.staff_id || null,
          starts_at: hondurasLocalToIso(blockForm.starts_at),
          ends_at: hondurasLocalToIso(blockForm.ends_at),
          reason: blockForm.reason.trim() || null,
        }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo bloquear el horario')
      succeed('Horario bloqueado.')
      closeBlock()
      setDay(blockForm.starts_at.slice(0, 10))
      void load()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudo bloquear el horario')
    } finally {
      setSaving(false)
    }
  }

  async function removeBlock(block: Block) {
    const label = block.reason ? `«${block.reason}»` : 'este bloqueo'
    if (!window.confirm(`¿Quitar ${label}? Ese horario vuelve a estar disponible.`)) return
    setPendingId(block.id)
    try {
      const res = await suiteFetch(`${SUITE_BLOCKS_API}?id=${block.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error || 'No se pudo quitar el bloqueo')
      }
      succeed('Bloqueo quitado.')
      void load()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudo quitar el bloqueo')
    } finally {
      setPendingId(null)
    }
  }

  async function patchStatus(id: string, status: AppointmentStatus, customerName: string) {
    if (
      (status === 'cancelled' || status === 'no_show') &&
      !window.confirm(
        status === 'cancelled'
          ? `¿Cancelar la cita de ${customerName}?`
          : `¿Marcar que ${customerName} no vino?`
      )
    ) {
      return
    }
    setPendingId(id)
    try {
      const res = await suiteFetch(SUITE_APPOINTMENTS_API, {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error || 'No se pudo actualizar la cita')
      }
      succeed(`Cita de ${customerName}: ${appointmentStatusLabel(status).toLowerCase()}.`)
      void load()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudo actualizar la cita')
    } finally {
      setPendingId(null)
    }
  }

  const days = groupAgendaByDay(rows, blocks)
  const step = view === 'week' ? 7 : 1
  const rangeLabel =
    view === 'week'
      ? `7 días desde el ${formatDayHeadingForHonduras(range.from)}`
      : day === today
        ? `Hoy, ${formatDayHeadingForHonduras(range.from)}`
        : formatDayHeadingForHonduras(range.from)

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Agenda · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Agenda</h1>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={openCreate}>
              <CalendarPlus className="mr-1.5 h-4 w-4" />
              Nueva cita
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={openBlock}>
              <Ban className="mr-1.5 h-4 w-4" />
              Bloquear horario
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={SUITE_EQUIPO_PATH}>
                <Users className="mr-1.5 h-4 w-4" />
                Equipo
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={view === 'week' ? 'Semana anterior' : 'Día anterior'}
              onClick={() => setDay((d) => shiftDay(d, -step))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <input
              type="date"
              aria-label="Elegir fecha"
              className="input-glass px-3 py-2 text-sm"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={view === 'week' ? 'Semana siguiente' : 'Día siguiente'}
              onClick={() => setDay((d) => shiftDay(d, step))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          {day !== today ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setDay(today)}>
              Hoy
            </Button>
          ) : null}
          <div className="inline-flex rounded-lg border border-white/15 p-0.5" role="group" aria-label="Vista">
            {(['day', 'week'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  view === option ? 'bg-brand-600/40 font-semibold text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                {option === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
        </div>

        <Notices notice={notice} error={error} onRetry={error ? () => void load() : undefined} />

        {inquiries.length > 0 ? (
          <section className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
            <h2 className="text-sm font-semibold">Solicitudes por agendar ({inquiries.length})</h2>
            <p className="text-xs text-white/55">
              Personas que escribieron desde tu página. Elige día y hora para convertirlas en cita.
            </p>
            <ul className="space-y-2">
              {inquiries.map((inq) => (
                <li key={inq.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{inq.full_name}</span>
                    {inq.phone ? <span className="text-white/60"> · {inq.phone}</span> : null}
                    <span className="block text-xs text-white/55">
                      Escribió el {formatDateTimeForHonduras(inq.created_at)}
                    </span>
                  </span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => openConvert(inq)}>
                    Agendar
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <h2 className="text-sm font-semibold text-white/80 first-letter:uppercase">{rangeLabel}</h2>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando citas…
          </p>
        ) : days.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center">
            <p className="text-sm text-white/60">
              {view === 'week' ? 'No hay citas esta semana.' : 'No hay citas este día.'}
            </p>
            <Button type="button" size="sm" className="mt-3" onClick={openCreate}>
              Crear una cita
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {days.map((group) => (
              <section key={group.day} className="space-y-2">
                {view === 'week' ? (
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {formatDayHeadingForHonduras(`${group.day}T12:00:00-06:00`)}
                  </h3>
                ) : null}
                <ul className="space-y-2">
                  {group.entries.map((entry) =>
                    entry.kind === 'block' ? (
                      <BlockRow
                        key={`b-${entry.item.id}`}
                        block={entry.item}
                        staffName={staff.find((s) => s.id === entry.item.staff_id)?.name ?? null}
                        pending={pendingId === entry.item.id}
                        onRemove={() => void removeBlock(entry.item)}
                      />
                    ) : (
                      <AppointmentRow
                        key={`a-${entry.item.id}`}
                        row={entry.item}
                        pending={pendingId === entry.item.id}
                        onStatus={patchStatus}
                      />
                    )
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}

        {dialog ? (
          <Dialog
            title={dialog.kind === 'convert' ? `Agendar a ${dialog.inquiry.full_name}` : 'Nueva cita'}
            onClose={closeDialog}
          >
            <form
              className="space-y-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void saveAppointment()
              }}
            >
              {dialog.kind === 'create' ? (
                <>
                  <Field label="Cliente" error={formErrors.customer_name}>
                    <input
                      className={fieldClass}
                      value={form.customer_name}
                      autoComplete="off"
                      aria-invalid={Boolean(formErrors.customer_name)}
                      onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                    />
                  </Field>
                  <Field label="WhatsApp (opcional)" error={formErrors.customer_phone}>
                    <input
                      className={fieldClass}
                      type="tel"
                      inputMode="tel"
                      placeholder="9876-1004"
                      value={form.customer_phone}
                      aria-invalid={Boolean(formErrors.customer_phone)}
                      onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    />
                  </Field>
                </>
              ) : (
                <p className="text-sm text-white/70">
                  {dialog.inquiry.full_name}
                  {dialog.inquiry.phone ? ` · ${dialog.inquiry.phone}` : ''}
                </p>
              )}
              <Field label="Fecha y hora" error={formErrors.starts_at}>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={form.starts_at}
                  aria-invalid={Boolean(formErrors.starts_at)}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </Field>
              <Field label="Servicio">
                <select
                  className={fieldClass}
                  value={form.service_id}
                  onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))}
                >
                  <option value="">Sin servicio</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration_min} min
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quién atiende">
                <select
                  className={fieldClass}
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
              </Field>
              {dialog.kind === 'create' ? (
                <Field label="Notas (opcional)">
                  <textarea
                    className={fieldClass}
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </Field>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {dialog.kind === 'convert' ? 'Agendar cita' : 'Guardar cita'}
                </Button>
              </div>
            </form>
          </Dialog>
        ) : null}

        {showBlock ? (
          <Dialog title="Bloquear horario" onClose={closeBlock}>
            <form
              className="space-y-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void saveBlock()
              }}
            >
              <p className="text-sm text-white/60">Nadie podrá reservar en ese rango desde tu página.</p>
              <Field label="Desde" error={blockErrors.starts_at}>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={blockForm.starts_at}
                  aria-invalid={Boolean(blockErrors.starts_at)}
                  onChange={(e) => setBlockForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </Field>
              <Field label="Hasta" error={blockErrors.ends_at}>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={blockForm.ends_at}
                  aria-invalid={Boolean(blockErrors.ends_at)}
                  onChange={(e) => setBlockForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </Field>
              <Field label="Para quién">
                <select
                  className={fieldClass}
                  value={blockForm.staff_id}
                  onChange={(e) => setBlockForm((f) => ({ ...f, staff_id: e.target.value }))}
                >
                  <option value="">Todo el negocio</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo (opcional)">
                <input
                  className={fieldClass}
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={closeBlock}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Bloquear
                </Button>
              </div>
            </form>
          </Dialog>
        ) : null}
      </div>
    </SuiteShell>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm text-white/80">
      {label}
      {children}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </label>
  )
}

function AppointmentRow({
  row,
  pending,
  onStatus,
}: {
  row: Appointment
  pending: boolean
  onStatus: (id: string, status: AppointmentStatus, customerName: string) => void
}) {
  const customer = one(row.customers)
  const member = one(row.staff_members)
  const service = one(row.bookable_services)
  const customerName = customer?.name || 'este cliente'
  const wa = customer?.phone ? whatsappHref(customer.phone) : null
  const actions = (['confirmed', 'completed', 'cancelled', 'no_show'] as const).filter(
    (status) => status !== row.status
  )

  return (
    <li
      className={`rounded-xl border px-3 py-3 text-sm ${STATUS_COLOR[row.status] || STATUS_COLOR.confirmed}`}
      style={member?.color ? { borderLeftWidth: 4, borderLeftColor: member.color } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold tabular-nums">
            {formatTimeForHonduras(row.starts_at)} – {formatTimeForHonduras(row.ends_at)}
          </p>
          <p className="font-medium">{customer?.name || 'Sin nombre'}</p>
          <p className="text-xs text-white/60">
            {[service?.name, member ? `Atiende ${member.name}` : null].filter(Boolean).join(' · ')}
          </p>
          {customer?.phone ? (
            <p className="text-xs text-white/60">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sky-200 hover:underline">
                  {customer.phone}
                </a>
              ) : (
                customer.phone
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {row.source === 'web' ? (
            <span className="rounded-full bg-violet-400/20 px-2 py-0.5 text-violet-100">Reservó en la web</span>
          ) : null}
          <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[row.status] ?? STATUS_BADGE.confirmed}`}>
            {appointmentStatusLabel(row.status)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            disabled={pending}
            variant={status === 'confirmed' && row.status === 'pending' ? 'default' : 'secondary'}
            onClick={() => onStatus(row.id, status, customerName)}
          >
            {APPOINTMENT_STATUS_COPY[status].action}
          </Button>
        ))}
      </div>
    </li>
  )
}

function BlockRow({
  block,
  staffName,
  pending,
  onRemove,
}: {
  block: Block
  staffName: string | null
  pending: boolean
  onRemove: () => void
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2 text-sm">
      <div>
        <p className="tabular-nums text-white/80">
          {formatTimeForHonduras(block.starts_at)} – {formatTimeForHonduras(block.ends_at)}
        </p>
        <p className="text-white/60">
          Bloqueado{block.reason ? ` · ${block.reason}` : ''}
          {staffName ? ` · ${staffName}` : ' · Todo el negocio'}
        </p>
      </div>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onRemove}>
        Quitar bloqueo
      </Button>
    </li>
  )
}
