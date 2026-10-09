import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { Loader2, Trash2 } from 'lucide-react'
import LandingSplitEditor from '../../../components/landings/editor/LandingSplitEditor'
import Notices from '../../../components/suite/Notices'
import SuiteShell from '../../../components/suite/SuiteShell'
import { useNotice } from '../../../components/suite/useNotice'
import { Button } from '../../../components/ui/button'
import { suiteFetch } from '../../../lib/auth/client-session'
import { suiteEditorFormSchema } from '../../../lib/landings/editor-form'
import type { LandingEditRecord, SaveLandingDraftInput } from '../../../lib/landings/editor-types'
import type { InventoryProductView } from '../../../lib/landings/inventory'
import { validateServiceForm, type FormErrors } from '../../../lib/suite/agenda'
import { fetchSuiteInventory } from '../../../lib/suite/inventory-api'
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

function SuitePageEditor({ hasInventory }: { hasInventory: boolean }) {
  const [initial, setInitial] = useState<LandingEditRecord | null>(null)
  const [inventory, setInventory] = useState<InventoryProductView[] | null>(null)
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

  useEffect(() => {
    if (!hasInventory) return
    let active = true
    // Sin inventario el editor sigue funcionando: solo no ofrece vincular.
    fetchSuiteInventory()
      .then(({ products }) => {
        if (active) setInventory(products)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [hasInventory])

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
      mode="owner"
      inventory={inventory}
    />
  )
}

function ServicesPanel() {
  const [services, setServices] = useState<
    { id: string; name: string; price_cents: number; duration_min: number; is_active: boolean }[]
  >([])
  const [svcForm, setSvcForm] = useState({ name: '', price: '', duration: '30' })
  const [formErrors, setFormErrors] = useState<FormErrors<'name' | 'price' | 'duration'>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { notice, error, succeed, fail } = useNotice()

  const load = useCallback(async () => {
    try {
      const res = await suiteFetch(SUITE_SERVICES_API)
      const body = (await res.json()) as { services?: typeof services; error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar los servicios')
      setServices(body.services ?? [])
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudieron cargar los servicios')
    } finally {
      setLoading(false)
    }
  }, [fail])

  useEffect(() => {
    void load()
  }, [load])

  async function addService() {
    const errors = validateServiceForm(svcForm)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      const res = await suiteFetch(SUITE_SERVICES_API, {
        method: 'POST',
        body: JSON.stringify({
          name: svcForm.name.trim(),
          price_cents: Math.round(Number(svcForm.price.replace(',', '.')) * 100),
          duration_min: Number(svcForm.duration),
        }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo crear el servicio')
      setSvcForm({ name: '', price: '', duration: '30' })
      succeed('Servicio agregado. Aparece en tu página cuando publiques los cambios.')
      void load()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudo crear el servicio')
    } finally {
      setSaving(false)
    }
  }

  async function removeService(id: string, name: string) {
    if (!window.confirm(`¿Eliminar el servicio «${name}»? Las citas ya agendadas se mantienen, pero quedan sin servicio.`)) return
    setPendingId(id)
    try {
      const res = await suiteFetch(`${SUITE_SERVICES_API}?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error || 'No se pudo eliminar el servicio')
      }
      succeed(`Servicio «${name}» eliminado.`)
      void load()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'No se pudo eliminar el servicio')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h2 className="text-lg font-semibold">Servicios que se pueden reservar</h2>
        <p className="text-sm text-white/60">
          Tus clientes eligen uno de estos al pedir cita. Los precios se actualizan en tu página
          cuando publicas los cambios.
        </p>
      </div>
      <Notices notice={notice} error={error} />
      <form
        noValidate
        className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-start"
        onSubmit={(e) => {
          e.preventDefault()
          void addService()
        }}
      >
        <ServiceField label="Nombre del servicio" error={formErrors.name}>
          <input
            className="mt-1 w-full input-glass px-3 py-2 text-sm"
            placeholder="Ej.: Corte de cabello"
            value={svcForm.name}
            aria-invalid={Boolean(formErrors.name)}
            onChange={(e) => setSvcForm((f) => ({ ...f, name: e.target.value }))}
          />
        </ServiceField>
        <ServiceField label="Precio (L.)" error={formErrors.price}>
          <input
            className="mt-1 w-full input-glass px-3 py-2 text-sm"
            inputMode="decimal"
            placeholder="150"
            value={svcForm.price}
            aria-invalid={Boolean(formErrors.price)}
            onChange={(e) => setSvcForm((f) => ({ ...f, price: e.target.value }))}
          />
        </ServiceField>
        <ServiceField label="Duración (min)" error={formErrors.duration}>
          <input
            className="mt-1 w-full input-glass px-3 py-2 text-sm"
            inputMode="numeric"
            value={svcForm.duration}
            aria-invalid={Boolean(formErrors.duration)}
            onChange={(e) => setSvcForm((f) => ({ ...f, duration: e.target.value }))}
          />
        </ServiceField>
        <Button type="submit" className="sm:mt-6" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Agregar
        </Button>
      </form>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando servicios…
        </p>
      ) : services.length === 0 ? (
        <p className="text-sm text-white/50">Todavía no tienes servicios. Agrega el primero arriba.</p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{s.name}</span>
                <span className="text-white/60">
                  {' '}
                  · {s.price_cents === 0 ? 'Sin precio' : formatLempirasFromCents(s.price_cents)} ·{' '}
                  {s.duration_min} min
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-300 hover:text-red-200"
                disabled={pendingId === s.id}
                onClick={() => void removeService(s.id, s.name)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ServiceField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block text-xs text-white/70">
      {label}
      {children}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </label>
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

  const editing = tab === 'pagina' || !hasBooking

  return (
    <SuiteShell tenant={tenant} wide={editing}>
      <Head>
        <title>Mi sitio · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      {hasBooking ? (
        <div className="px-4 pt-4" role="tablist" aria-label="Mi sitio">
          <div className="inline-flex rounded-lg border border-white/15 p-0.5">
            {(
              [
                ['pagina', 'Página'],
                ['servicios', 'Servicios'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === value ? 'bg-brand-600/40 font-semibold text-white' : 'text-white/70 hover:text-white'
                }`}
                onClick={() => selectTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {editing ? (
        <SuitePageEditor hasInventory={tenant.modules.includes('inventario')} />
      ) : (
        <ServicesPanel />
      )}
    </SuiteShell>
  )
}
