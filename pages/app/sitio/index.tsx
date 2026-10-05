import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { Loader2 } from 'lucide-react'
import LandingSplitEditor from '../../../components/landings/editor/LandingSplitEditor'
import SuiteShell from '../../../components/suite/SuiteShell'
import { Button } from '../../../components/ui/button'
import { suiteFetch } from '../../../lib/auth/client-session'
import { suiteEditorFormSchema } from '../../../lib/landings/editor-form'
import type { LandingEditRecord, SaveLandingDraftInput } from '../../../lib/landings/editor-types'
import { SUITE_SERVICES_API } from '../../../lib/suite/paths'
import { formatLempirasFromCents } from '../../../lib/suite/schemas'
import {
  fetchSuiteSite,
  publishSuiteSite,
  saveSuiteSite,
} from '../../../lib/suite/site-editor-api'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'

type Tab = 'pagina' | 'servicios'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'sitio' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

function SuitePageEditor() {
  const [initial, setInitial] = useState<LandingEditRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { landing } = await fetchSuiteSite()
        if (active) setInitial(landing)
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el sitio')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const onSave = useCallback(async (input: SaveLandingDraftInput) => {
    const { landing } = await saveSuiteSite(input)
    setInitial(landing)
    return landing
  }, [])

  const onPublish = useCallback(
    async (action: 'publish' | 'unpublish') => publishSuiteSite(action),
    []
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-gray-300">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Cargando el editor…</span>
      </div>
    )
  }

  if (!initial) {
    return <p className="px-4 py-8 text-sm text-red-400">{error ?? 'Sitio no encontrado'}</p>
  }

  return (
    <LandingSplitEditor
      landingId={initial.id}
      initial={initial}
      formSchema={suiteEditorFormSchema}
      slugEditable={false}
      canUnpublish
      onSave={onSave}
      onPublish={onPublish}
    />
  )
}

function ServicesPanel() {
  const [services, setServices] = useState<
    { id: string; name: string; price_cents: number; duration_min: number; is_active: boolean }[]
  >([])
  const [svcForm, setSvcForm] = useState({ name: '', price: '150', duration: '30' })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await suiteFetch(SUITE_SERVICES_API)
      const body = (await res.json()) as { services?: typeof services; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar los servicios')
      setServices(body.services ?? [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los servicios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addService() {
    setNotice(null)
    const price_cents = Math.round(Number(svcForm.price) * 100)
    const res = await suiteFetch(SUITE_SERVICES_API, {
      method: 'POST',
      body: JSON.stringify({
        name: svcForm.name,
        price_cents,
        duration_min: Number(svcForm.duration) || 30,
      }),
    })
    const body = (await res.json()) as { error?: string }
    if (!res.ok) {
      setError(body.error || 'No se pudo crear el servicio')
      return
    }
    setSvcForm({ name: '', price: '150', duration: '30' })
    setNotice('Servicio agregado. Al publicar se sincroniza en el menú de la página.')
    void load()
  }

  async function removeService(id: string) {
    setNotice(null)
    const res = await suiteFetch(`${SUITE_SERVICES_API}?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      setError(body.error || 'No se pudo eliminar')
      return
    }
    void load()
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h2 className="text-lg font-semibold">Servicios reservables</h2>
        <p className="text-sm text-white/60">
          Estos precios se inyectan en el bloque de ítems al publicar la página.
        </p>
      </div>
      {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? <p className="text-sm text-white/60">Cargando…</p> : null}
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm"
          placeholder="Nombre"
          value={svcForm.name}
          onChange={(e) => setSvcForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className="w-24 rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm"
          placeholder="Precio"
          value={svcForm.price}
          onChange={(e) => setSvcForm((f) => ({ ...f, price: e.target.value }))}
        />
        <input
          className="w-24 rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm"
          placeholder="Min"
          value={svcForm.duration}
          onChange={(e) => setSvcForm((f) => ({ ...f, duration: e.target.value }))}
        />
        <Button size="sm" type="button" onClick={() => void addService()}>
          Agregar
        </Button>
      </div>
      <ul className="space-y-2">
        {services.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm"
          >
            <span>
              {s.name} · {formatLempirasFromCents(s.price_cents)} · {s.duration_min} min
            </span>
            <button type="button" className="text-red-300 underline" onClick={() => void removeService(s.id)}>
              Eliminar
            </button>
          </li>
        ))}
        {!loading && services.length === 0 ? (
          <li className="text-sm text-white/50">Sin servicios todavía.</li>
        ) : null}
      </ul>
    </section>
  )
}

export default function SitioPage({ tenant }: { tenant: SuiteTenant }) {
  const router = useRouter()
  const hasBooking = tenant.modules.includes('reservas')
  const [tab, setTab] = useState<Tab>('pagina')

  useEffect(() => {
    const raw = router.query.tab
    if (raw === 'servicios' && hasBooking) setTab('servicios')
    if (raw === 'pagina') setTab('pagina')
  }, [router.query.tab, hasBooking])

  function selectTab(next: Tab) {
    setTab(next)
    void router.replace(
      { pathname: router.pathname, query: next === 'pagina' ? {} : { tab: next } },
      undefined,
      { shallow: true }
    )
  }

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Mi sitio · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      {hasBooking ? (
        <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 pt-4 text-sm">
          <button
            type="button"
            className={`rounded px-3 py-1 ${tab === 'pagina' ? 'bg-sky-500/30' : 'bg-white/5'}`}
            onClick={() => selectTab('pagina')}
          >
            Página
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 ${tab === 'servicios' ? 'bg-sky-500/30' : 'bg-white/5'}`}
            onClick={() => selectTab('servicios')}
          >
            Servicios
          </button>
        </div>
      ) : null}
      {tab === 'pagina' || !hasBooking ? <SuitePageEditor /> : <ServicesPanel />}
    </SuiteShell>
  )
}
