/**
 * Agenda del owner: agrupa citas y bloqueos por día y valida los formularios
 * antes de llamar a la API, con mensajes que el owner entiende.
 */

import { hondurasDateKey } from '../timezone'

/** Fecha local "YYYY-MM-DDTHH:mm" (input datetime-local) a ISO en hora de Honduras. */
export function hondurasLocalToIso(local: string): string {
  return new Date(`${local}:00-06:00`).toISOString()
}

/** Suma días a una fecha YYYY-MM-DD sin pasar por la zona horaria del navegador. */
export function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

export interface AgendaItemBase {
  id: string
  starts_at: string
  ends_at: string
}

export type AgendaEntry<A extends AgendaItemBase, B extends AgendaItemBase> =
  | { kind: 'appointment'; item: A }
  | { kind: 'block'; item: B }

export interface AgendaDay<A extends AgendaItemBase, B extends AgendaItemBase> {
  day: string
  entries: AgendaEntry<A, B>[]
}

/** Citas y bloqueos ordenados por hora y agrupados por día (hora de Honduras). */
export function groupAgendaByDay<A extends AgendaItemBase, B extends AgendaItemBase>(
  appointments: A[],
  blocks: B[]
): AgendaDay<A, B>[] {
  const entries: AgendaEntry<A, B>[] = [
    ...appointments.map((item) => ({ kind: 'appointment' as const, item })),
    ...blocks.map((item) => ({ kind: 'block' as const, item })),
  ].sort((a, b) => a.item.starts_at.localeCompare(b.item.starts_at))

  const days: AgendaDay<A, B>[] = []
  for (const entry of entries) {
    const day = hondurasDateKey(entry.item.starts_at)
    const last = days[days.length - 1]
    if (last && last.day === day) last.entries.push(entry)
    else days.push({ day, entries: [entry] })
  }
  return days
}

export interface AppointmentFormInput {
  customer_name: string
  customer_phone: string
  starts_at: string
}

export type FormErrors<K extends string> = Partial<Record<K, string>>

/** `contact: false` cuando nombre y teléfono vienen de una solicitud y no se editan. */
export function validateAppointmentForm(
  form: AppointmentFormInput,
  { contact = true }: { contact?: boolean } = {}
): FormErrors<keyof AppointmentFormInput> {
  const errors: FormErrors<keyof AppointmentFormInput> = {}
  if (contact) {
    if (!form.customer_name.trim()) errors.customer_name = 'Escribe el nombre del cliente.'
    const digits = form.customer_phone.replace(/\D/g, '')
    if (form.customer_phone.trim() && digits.length < 7) {
      errors.customer_phone = 'El número parece incompleto (mínimo 7 dígitos).'
    }
  }
  if (!form.starts_at) errors.starts_at = 'Elige la fecha y hora.'
  return errors
}

export interface BlockFormInput {
  starts_at: string
  ends_at: string
}

export function validateBlockForm(form: BlockFormInput): FormErrors<keyof BlockFormInput> {
  const errors: FormErrors<keyof BlockFormInput> = {}
  if (!form.starts_at) errors.starts_at = 'Elige desde cuándo.'
  if (!form.ends_at) errors.ends_at = 'Elige hasta cuándo.'
  if (form.starts_at && form.ends_at && form.ends_at <= form.starts_at) {
    errors.ends_at = 'La hora final tiene que ser después de la inicial.'
  }
  return errors
}

export interface ServiceFormInput {
  name: string
  price: string
  duration: string
}

export function validateServiceForm(form: ServiceFormInput): FormErrors<keyof ServiceFormInput> {
  const errors: FormErrors<keyof ServiceFormInput> = {}
  if (!form.name.trim()) errors.name = 'Escribe el nombre del servicio.'
  const price = Number(form.price.replace(',', '.'))
  if (form.price.trim() === '' || !Number.isFinite(price) || price < 0) {
    errors.price = 'Escribe un precio válido (0 si es gratis).'
  }
  const duration = Number(form.duration)
  // Mismo rango que la base de datos (bookable_services_duration).
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    errors.duration = 'Entre 5 y 480 minutos.'
  }
  return errors
}

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export interface ScheduleSlot {
  weekday: number
  start_time: string
  end_time: string
}

/**
 * Horario legible: "Lun a Vie 08:00–17:00 · Sáb 08:00–14:00".
 * Une días seguidos con el mismo horario (weekday 0 = domingo).
 */
export function summarizeSchedules(slots: ScheduleSlot[]): string {
  if (slots.length === 0) return 'Sin horario'
  const sorted = [...slots].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)
  )
  const hours = (slot: ScheduleSlot) => `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`
  const runs: { from: number; to: number; hours: string }[] = []
  for (const slot of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.hours === hours(slot) && slot.weekday === last.to + 1) last.to = slot.weekday
    else runs.push({ from: slot.weekday, to: slot.weekday, hours: hours(slot) })
  }
  return runs
    .map((run) => {
      const days =
        run.from === run.to
          ? WEEKDAY_SHORT[run.from]
          : `${WEEKDAY_SHORT[run.from]} a ${WEEKDAY_SHORT[run.to]}`
      return `${days} ${run.hours}`
    })
    .join(' · ')
}
