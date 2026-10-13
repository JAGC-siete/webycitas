import { useCallback, useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { Download, Loader2, Search } from 'lucide-react'
import Notices from '../../../components/suite/Notices'
import SuiteShell from '../../../components/suite/SuiteShell'
import { useNotice } from '../../../components/suite/useNotice'
import { Button } from '../../../components/ui/button'
import { suiteFetch } from '../../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'
import { SUITE_CUSTOMERS_API } from '../../../lib/suite/paths'
import { appointmentStatusLabel } from '../../../lib/suite/schemas'
import { formatDateTimeForHonduras } from '../../../lib/timezone'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'reservas' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function ClientesPage({ tenant }: { tenant: SuiteTenant }) {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const detailRef = useRef<HTMLElement>(null)
  const [rows, setRows] = useState<Customer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    customer: Customer
    history: { id: string; starts_at: string; status: string; bookable_services: { name: string } | null }[]
  } | null>(null)
  const [notes, setNotes] = useState('')
  const { notice, error, succeed, fail } = useNotice()

  // Busca cuando dejas de escribir, no con cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(q.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [q])

  const load = useCallback(async () => {
    try {
      const res = await suiteFetch(`${SUITE_CUSTOMERS_API}?q=${encodeURIComponent(query)}`)
      const body = (await res.json()) as { customers?: Customer[]; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar los clientes')
      setRows(body.customers ?? [])
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudieron cargar los clientes')
    } finally {
      setLoading(false)
    }
  }, [query, fail])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    // En celular el detalle queda debajo de la lista: lo traemos a la vista.
    if (detail && window.matchMedia('(max-width: 1023px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [detail])

  async function openDetail(id: string) {
    setSelected(id)
    const res = await suiteFetch(`${SUITE_CUSTOMERS_API}?id=${id}`)
    const body = (await res.json()) as {
      customer?: Customer
      history?: { id: string; starts_at: string; status: string; bookable_services: { name: string } | null }[]
      error?: string
    }
    if (!res.ok || !body.customer) {
      fail(body.error || 'No se pudo abrir el cliente')
      return
    }
    setDetail({ customer: body.customer, history: body.history ?? [] })
    setNotes(body.customer.notes || '')
  }

  async function saveNotes() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await suiteFetch(SUITE_CUSTOMERS_API, {
        method: 'PATCH',
        body: JSON.stringify({ id: selected, notes }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error || 'No se pudieron guardar las notas')
      }
      succeed('Notas guardadas.')
      void load()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudieron guardar las notas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Clientes · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Clientes</h1>
          <Button asChild size="sm" variant="secondary">
            <a href={`${SUITE_CUSTOMERS_API}?export=csv`}>
              <Download className="mr-1.5 h-4 w-4" />
              Descargar lista (Excel/CSV)
            </a>
          </Button>
        </div>

        <label className="relative block max-w-md">
          <span className="sr-only">Buscar cliente</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            type="search"
            className="input-glass w-full py-2 pl-9 pr-3 text-sm"
            placeholder="Buscar por nombre, teléfono o correo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        <Notices notice={notice} error={error} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  aria-pressed={selected === row.id}
                  className={`glass-modern w-full rounded-xl px-3 py-2 text-left text-sm transition hover:border-brand-400/40 ${
                    selected === row.id ? 'border-brand-400/60' : ''
                  }`}
                  onClick={() => void openDetail(row.id)}
                >
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-white/50">{[row.phone, row.email].filter(Boolean).join(' · ')}</p>
                </button>
              </li>
            ))}
            {loading ? (
              <li className="flex items-center gap-2 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando clientes…
              </li>
            ) : rows.length === 0 ? (
              <li className="text-sm text-white/50">
                {query ? `Nadie coincide con «${query}».` : 'Todavía no tienes clientes. Aparecen al crear o recibir citas.'}
              </li>
            ) : null}
          </ul>

          {detail ? (
            <section ref={detailRef} className="glass-modern scroll-mt-4 space-y-3 rounded-2xl p-4">
              <h2 className="font-semibold">{detail.customer.name}</h2>
              <p className="text-sm text-white/60">
                {[detail.customer.phone, detail.customer.email].filter(Boolean).join(' · ') || 'Sin contacto'}
              </p>
              <label className="block text-xs text-white/60">
                Notas (solo las ves tú)
                <textarea
                  className="mt-1 w-full input-glass px-2 py-1 text-sm text-white"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <Button type="button" size="sm" disabled={saving} onClick={() => void saveNotes()}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Guardar notas
              </Button>
              <div>
                <h3 className="text-sm font-medium">Historial de citas</h3>
                <ul className="mt-2 space-y-1 text-xs text-white/70">
                  {detail.history.map((visit) => {
                    const service = Array.isArray(visit.bookable_services)
                      ? visit.bookable_services[0]
                      : visit.bookable_services
                    return (
                      <li key={visit.id}>
                        {formatDateTimeForHonduras(visit.starts_at)} · {appointmentStatusLabel(visit.status)}
                        {service?.name ? ` · ${service.name}` : ''}
                      </li>
                    )
                  })}
                  {detail.history.length === 0 ? <li>Sin visitas registradas.</li> : null}
                </ul>
              </div>
            </section>
          ) : (
            <p className="text-sm text-white/50">Elige un cliente para ver sus citas y notas.</p>
          )}
        </div>

      </div>
    </SuiteShell>
  )
}
