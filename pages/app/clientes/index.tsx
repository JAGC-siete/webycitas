import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../components/suite/SuiteShell'
import { suiteFetch } from '../../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'
import { SUITE_CLIENTES_PATH, SUITE_CUSTOMERS_API } from '../../../lib/suite/paths'
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
  const [rows, setRows] = useState<Customer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    customer: Customer
    history: { id: string; starts_at: string; status: string; bookable_services: { name: string } | null }[]
  } | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await suiteFetch(`${SUITE_CUSTOMERS_API}?q=${encodeURIComponent(q)}`)
    const body = (await res.json()) as { customers?: Customer[]; error?: string }
    if (!res.ok) {
      setError(body.error || 'No se pudieron cargar clientes')
      return
    }
    setRows(body.customers ?? [])
  }, [q])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(id: string) {
    setSelected(id)
    const res = await suiteFetch(`${SUITE_CUSTOMERS_API}?id=${id}`)
    const body = (await res.json()) as {
      customer?: Customer
      history?: { id: string; starts_at: string; status: string; bookable_services: { name: string } | null }[]
      error?: string
    }
    if (!res.ok || !body.customer) {
      setError(body.error || 'No se pudo abrir')
      return
    }
    setDetail({ customer: body.customer, history: body.history ?? [] })
    setNotes(body.customer.notes || '')
  }

  async function saveNotes() {
    if (!selected) return
    const res = await suiteFetch(SUITE_CUSTOMERS_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: selected, notes }),
    })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      setError(body.error || 'No se pudo guardar')
      return
    }
    setNotice('Notas guardadas')
    void load()
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
          <a
            className="text-sm text-sky-200 hover:underline"
            href={`${SUITE_CUSTOMERS_API}?export=csv`}
          >
            Exportar CSV
          </a>
        </div>

        <input
          className="w-full max-w-md rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm"
          placeholder="Buscar nombre, teléfono o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full rounded border border-white/10 bg-slate-900/50 px-3 py-2 text-left text-sm hover:border-sky-400/40"
                  onClick={() => void openDetail(row.id)}
                >
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-white/50">{[row.phone, row.email].filter(Boolean).join(' · ')}</p>
                </button>
              </li>
            ))}
            {rows.length === 0 ? <li className="text-sm text-white/50">Sin clientes todavía.</li> : null}
          </ul>

          {detail ? (
            <section className="space-y-3 rounded border border-white/10 bg-slate-900/40 p-4">
              <h2 className="font-semibold">{detail.customer.name}</h2>
              <p className="text-sm text-white/60">
                {[detail.customer.phone, detail.customer.email].filter(Boolean).join(' · ') || 'Sin contacto'}
              </p>
              <label className="block text-xs text-white/50">
                Notas
                <textarea
                  className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-sm text-white"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button type="button" className="rounded bg-sky-500/30 px-3 py-1 text-sm" onClick={() => void saveNotes()}>
                Guardar notas
              </button>
              <div>
                <h3 className="text-sm font-medium">Historial</h3>
                <ul className="mt-2 space-y-1 text-xs text-white/70">
                  {detail.history.map((visit) => {
                    const service = Array.isArray(visit.bookable_services)
                      ? visit.bookable_services[0]
                      : visit.bookable_services
                    return (
                      <li key={visit.id}>
                        {formatDateTimeForHonduras(visit.starts_at)} · {visit.status}
                        {service?.name ? ` · ${service.name}` : ''}
                      </li>
                    )
                  })}
                  {detail.history.length === 0 ? <li>Sin visitas registradas.</li> : null}
                </ul>
              </div>
            </section>
          ) : (
            <p className="text-sm text-white/40">Elegí un cliente para ver el historial.</p>
          )}
        </div>

        <p className="text-xs text-white/30">
          Tip: el CSV se descarga con sesión activa desde{' '}
          <Link href={SUITE_CLIENTES_PATH} className="underline">
            esta pantalla
          </Link>
          .
        </p>
      </div>
    </SuiteShell>
  )
}
