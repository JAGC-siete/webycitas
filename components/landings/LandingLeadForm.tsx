/**
 * Formulario de captura de la landing publicada.
 * `layout: booking` intenta agenda real (servicios UUID + slots vivos → /api/public/book).
 * Si el site no tiene staff/servicios, cae al inquiry clásico (/api/inquiries).
 */

import React, { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import {
  LANDING_LEAD_API_PATH,
  PUBLIC_AVAILABILITY_API_PATH,
  PUBLIC_BOOK_API_PATH,
  PUBLIC_SERVICES_API_PATH,
} from '../../lib/landings/paths'
import { landingLeadFieldErrors, parseLandingLead } from '../../lib/landings/lead-schema'
import type { ServiceMenuItem } from '../../lib/landings/service-booking'
import { formatLempirasFromCents, hondurasTodayDate } from '../../lib/suite/schemas'
import { formatDateTimeForHonduras } from '../../lib/timezone'
import type { LandingBlock } from '../../types/landing'

type LeadFormBlock = Extract<LandingBlock, { kind: 'leadForm' }>

interface LandingLeadFormProps {
  block: LeadFormBlock
  slug: string
  services?: ServiceMenuItem[]
  selectedService?: string
  onSelectedService?: (name: string) => void
}

type BookableService = {
  id: string
  name: string
  price_cents: number
  duration_min: number
}

type OpenSlot = {
  starts_at: string
  ends_at: string
  staff_id: string
}

const CONSENT_FALLBACK = 'Acepto que este negocio me contacte sobre mi solicitud.'

function composeBookingMessage(params: {
  service?: string
  slot?: string
  note?: string
}): string | undefined {
  const lines: string[] = []
  if (params.service) lines.push(`Servicio: ${params.service}`)
  if (params.slot) lines.push(`Horario preferido: ${params.slot}`)
  if (params.note) lines.push(params.note)
  const text = lines.join('\n').trim()
  return text.length > 0 ? text : undefined
}

function slotLabel(iso: string): string {
  return formatDateTimeForHonduras(iso)
}

export default function LandingLeadForm({
  block,
  slug,
  services = [],
  selectedService,
  onSelectedService,
}: LandingLeadFormProps) {
  const booking = block.layout === 'booking'
  const hintSlots = block.slotHints ?? []
  const today = useMemo(() => hondurasTodayDate(), [])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [serviceName, setServiceName] = useState(selectedService ?? '')
  const [hintSlot, setHintSlot] = useState('')
  const [consent, setConsent] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const [liveReady, setLiveReady] = useState(false)
  const [liveLoading, setLiveLoading] = useState(booking)
  const [bookableServices, setBookableServices] = useState<BookableService[]>([])
  const [serviceId, setServiceId] = useState('')
  const [day, setDay] = useState(today)
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<OpenSlot | null>(null)

  useEffect(() => {
    if (selectedService) setServiceName(selectedService)
  }, [selectedService])

  useEffect(() => {
    if (!booking || !slug) {
      setLiveLoading(false)
      return
    }
    let cancelled = false
    async function loadServices() {
      setLiveLoading(true)
      try {
        const res = await fetch(
          `${PUBLIC_SERVICES_API_PATH}?slug=${encodeURIComponent(slug)}`
        )
        const body = (await res.json().catch(() => ({}))) as {
          ready?: boolean
          services?: BookableService[]
        }
        if (cancelled) return
        if (res.ok && body.ready && (body.services?.length ?? 0) > 0) {
          setBookableServices(body.services ?? [])
          setLiveReady(true)
        } else {
          setLiveReady(false)
        }
      } catch {
        if (!cancelled) setLiveReady(false)
      } finally {
        if (!cancelled) setLiveLoading(false)
      }
    }
    void loadServices()
    return () => {
      cancelled = true
    }
  }, [booking, slug])

  useEffect(() => {
    if (!liveReady || !selectedService || bookableServices.length === 0) return
    const match = bookableServices.find((s) => s.name === selectedService)
    if (match) {
      setServiceId(match.id)
      setServiceName(match.name)
    }
  }, [liveReady, selectedService, bookableServices])

  useEffect(() => {
    if (!liveReady || !serviceId || !day) {
      setOpenSlots([])
      setSelectedSlot(null)
      return
    }
    let cancelled = false
    async function loadSlots() {
      setSlotsLoading(true)
      setSelectedSlot(null)
      try {
        const params = new URLSearchParams({
          slug,
          day,
          service_id: serviceId,
        })
        const res = await fetch(`${PUBLIC_AVAILABILITY_API_PATH}?${params}`)
        const body = (await res.json().catch(() => ({}))) as {
          slots?: OpenSlot[]
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setOpenSlots([])
          setErrors((prev) => ({ ...prev, slot: body.error || 'No se pudieron cargar horarios.' }))
          return
        }
        setErrors((prev) => {
          const next = { ...prev }
          delete next.slot
          return next
        })
        setOpenSlots(body.slots ?? [])
      } catch {
        if (!cancelled) setOpenSlots([])
      } finally {
        if (!cancelled) setSlotsLoading(false)
      }
    }
    void loadSlots()
    return () => {
      cancelled = true
    }
  }, [liveReady, serviceId, day, slug])

  function pickMenuService(name: string) {
    setServiceName(name)
    onSelectedService?.(name)
    const match = bookableServices.find((s) => s.name === name)
    if (match) setServiceId(match.id)
  }

  function pickLiveService(svc: BookableService) {
    setServiceId(svc.id)
    setServiceName(svc.name)
    onSelectedService?.(svc.name)
  }

  async function submitInquiry() {
    const payload = {
      slug,
      blockId: block.id,
      website: honeypot,
      fullName,
      email: email.trim() ? email : undefined,
      phone: block.fields.phone && phone.trim() ? phone : undefined,
      message: booking
        ? composeBookingMessage({
            service: serviceName,
            slot: hintSlot,
            note: message.trim() || undefined,
          })
        : block.fields.message && message.trim()
          ? message
          : undefined,
      consent,
    }

    const parsed = parseLandingLead(payload)
    if (!parsed.success) {
      setErrors(landingLeadFieldErrors(parsed.error))
      return
    }

    setErrors({})
    setSending(true)
    try {
      const res = await fetch(LANDING_LEAD_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setErrors({ submit: body.error || 'No se pudo enviar. Intenta de nuevo.' })
        return
      }
      setSent(true)
    } catch {
      setErrors({ submit: 'Sin conexión. Revisa tu internet e intenta de nuevo.' })
    } finally {
      setSending(false)
    }
  }

  async function submitLiveBook() {
    if (!serviceId) {
      setErrors({ service: 'Elige un servicio.' })
      return
    }
    if (!selectedSlot) {
      setErrors({ slot: 'Elige un horario disponible.' })
      return
    }
    if (!consent) {
      setErrors({ consent: 'Marca el consentimiento para enviar.' })
      return
    }
    if (!fullName.trim()) {
      setErrors({ fullName: 'Escribe tu nombre.' })
      return
    }
    if (!email.trim() && !phone.trim()) {
      setErrors({ email: 'Deja al menos un correo o un teléfono.' })
      return
    }

    setErrors({})
    setSending(true)
    try {
      const res = await fetch(PUBLIC_BOOK_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          service_id: serviceId,
          staff_id: selectedSlot.staff_id,
          starts_at: selectedSlot.starts_at,
          customer_name: fullName.trim(),
          customer_email: email.trim() || undefined,
          customer_phone: phone.trim() || undefined,
          notes: message.trim() || undefined,
          consent,
          website: honeypot,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        fields?: Record<string, string>
      }
      if (!res.ok) {
        if (body.fields) setErrors(body.fields)
        else setErrors({ submit: body.error || 'No se pudo enviar. Intenta de nuevo.' })
        return
      }
      setSent(true)
    } catch {
      setErrors({ submit: 'Sin conexión. Revisa tu internet e intenta de nuevo.' })
    } finally {
      setSending(false)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return

    if (liveReady) {
      await submitLiveBook()
      return
    }

    if (booking && services.length > 0 && !serviceName) {
      setErrors({ service: 'Elige un servicio.' })
      return
    }
    if (booking && hintSlots.length > 0 && !hintSlot) {
      setErrors({ slot: 'Elige un horario preferido.' })
      return
    }
    await submitInquiry()
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-[var(--lp-primary)]/30 bg-white/80 p-6 text-slate-900">
        <p className="text-lg font-semibold">
          {liveReady ? 'Solicitud enviada' : block.successTitle}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {liveReady
            ? 'Te confirmamos el horario pronto. Revisa WhatsApp o tu correo.'
            : block.successBody}
        </p>
      </div>
    )
  }

  const showLive = booking && liveReady
  const showHints = booking && !liveReady && !liveLoading

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {liveLoading ? (
        <p className="text-sm text-slate-600">Cargando agenda…</p>
      ) : null}

      {showLive ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">1. Servicio</legend>
          <div className="flex flex-wrap gap-2">
            {bookableServices.map((item) => {
              const active = serviceId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickLiveService(item)}
                  className={`rounded-full border px-3 py-2 text-left text-sm ${
                    active
                      ? 'border-[var(--lp-primary)] bg-[var(--lp-primary)] text-white'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-xs opacity-80">
                    {formatLempirasFromCents(item.price_cents)} · {item.duration_min} min
                  </span>
                </button>
              )
            })}
          </div>
          {errors.service && <p className="mt-1 text-xs text-red-500">{errors.service}</p>}
        </fieldset>
      ) : null}

      {showHints && services.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">1. Servicio</legend>
          <div className="flex flex-wrap gap-2">
            {services.map((item) => {
              const active = serviceName === item.name
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => pickMenuService(item.name)}
                  className={`rounded-full border px-3 py-2 text-left text-sm ${
                    active
                      ? 'border-[var(--lp-primary)] bg-[var(--lp-primary)] text-white'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  <span className="block font-medium">{item.name}</span>
                  {item.priceLabel ? (
                    <span className="block text-xs opacity-80">{item.priceLabel}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
          {errors.service && <p className="mt-1 text-xs text-red-500">{errors.service}</p>}
        </fieldset>
      ) : null}

      {showLive ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">2. Día y horario</legend>
          <p className="mb-2 text-xs opacity-70">
            Horarios reales según la agenda. La cita queda pendiente hasta que el negocio confirme.
          </p>
          <label className="mb-3 block text-sm">
            Día
            <Input
              type="date"
              min={today}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1 bg-white text-slate-900"
            />
          </label>
          {slotsLoading ? <p className="text-xs text-slate-600">Buscando horarios…</p> : null}
          {!slotsLoading && serviceId && openSlots.length === 0 ? (
            <p className="text-xs text-slate-600">No hay cupos ese día. Prueba otra fecha.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {openSlots.map((slot) => {
              const active = selectedSlot?.starts_at === slot.starts_at && selectedSlot.staff_id === slot.staff_id
              return (
                <button
                  key={`${slot.staff_id}-${slot.starts_at}`}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    active
                      ? 'border-[var(--lp-primary)] bg-[var(--lp-primary)] text-white'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {slotLabel(slot.starts_at)}
                </button>
              )
            })}
          </div>
          {errors.slot && <p className="mt-1 text-xs text-red-500">{errors.slot}</p>}
        </fieldset>
      ) : null}

      {showHints && hintSlots.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">2. Horario que te queda</legend>
          <p className="mb-2 text-xs opacity-70">
            Preferencia de horario. Te confirmamos la hora exacta por WhatsApp.
          </p>
          <div className="flex flex-wrap gap-2">
            {hintSlots.map((hint) => {
              const active = hintSlot === hint
              return (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setHintSlot(hint)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    active
                      ? 'border-[var(--lp-primary)] bg-[var(--lp-primary)] text-white'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {hint}
                </button>
              )
            })}
          </div>
          {errors.slot && <p className="mt-1 text-xs text-red-500">{errors.slot}</p>}
        </fieldset>
      ) : null}

      <div className="space-y-4">
        {booking ? <p className="text-sm font-semibold">3. Tus datos</p> : null}

        <div>
          <label htmlFor={`${block.id}-name`} className="mb-1 block text-sm font-medium">
            Nombre
          </label>
          <Input
            id={`${block.id}-name`}
            name="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className="bg-white text-slate-900"
            aria-invalid={Boolean(errors.fullName || errors.customer_name)}
          />
          {(errors.fullName || errors.customer_name) && (
            <p className="mt-1 text-xs text-red-500">{errors.fullName || errors.customer_name}</p>
          )}
        </div>

        <div>
          <label htmlFor={`${block.id}-email`} className="mb-1 block text-sm font-medium">
            Correo
          </label>
          <Input
            id={`${block.id}-email`}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="bg-white text-slate-900"
            aria-invalid={Boolean(errors.email || errors.customer_email)}
          />
          {(errors.email || errors.customer_email) && (
            <p className="mt-1 text-xs text-red-500">{errors.email || errors.customer_email}</p>
          )}
        </div>

        {block.fields.phone && (
          <div>
            <label htmlFor={`${block.id}-phone`} className="mb-1 block text-sm font-medium">
              Teléfono o WhatsApp
            </label>
            <Input
              id={`${block.id}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="bg-white text-slate-900"
              aria-invalid={Boolean(errors.phone || errors.customer_phone)}
            />
            {(errors.phone || errors.customer_phone) && (
              <p className="mt-1 text-xs text-red-500">{errors.phone || errors.customer_phone}</p>
            )}
          </div>
        )}

        {block.fields.message && (
          <div>
            <label htmlFor={`${block.id}-message`} className="mb-1 block text-sm font-medium">
              {booking ? 'Nota (profesional, detalle)' : 'Mensaje'}
            </label>
            <Textarea
              id={`${block.id}-message`}
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={booking ? 2 : 4}
              className="bg-white text-slate-900"
              aria-invalid={Boolean(errors.message || errors.notes)}
            />
            {(errors.message || errors.notes) && (
              <p className="mt-1 text-xs text-red-500">{errors.message || errors.notes}</p>
            )}
          </div>
        )}
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${block.id}-website`}>Sitio web</label>
        <input
          id={`${block.id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-2 text-xs leading-relaxed">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--lp-primary)]"
        />
        <span>{block.consentText || CONSENT_FALLBACK}</span>
      </label>
      {errors.consent && <p className="text-xs text-red-500">{errors.consent}</p>}

      {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}

      <Button
        type="submit"
        disabled={sending || liveLoading}
        className="h-12 w-full bg-[var(--lp-primary)] text-white shadow-none hover:bg-[var(--lp-primary)] hover:opacity-90"
      >
        {sending ? 'Enviando…' : block.submitLabel}
      </Button>
    </form>
  )
}
