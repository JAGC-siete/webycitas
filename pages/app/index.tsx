import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../components/suite/SuiteShell'
import { Button } from '../../components/ui/button'
import { suiteFetch } from '../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../lib/suite/tenant'
import {
  SUITE_DASHBOARD_API,
  SUITE_EQUIPO_PATH,
  SUITE_INVENTARIO_PATH,
  SUITE_RESERVAS_PATH,
  SUITE_SITIO_PATH,
} from '../../lib/suite/paths'
import { formatLempirasFromCents } from '../../lib/suite/schemas'
import { suiteUpgradeBookingHref } from '../../lib/suite/upgrade'
import { formatDateTimeForHonduras } from '../../lib/timezone'

interface DashboardPayload {
  day: string
  modules: string[]
  site: {
    id: string
    slug: string
    title: string
    status: 'draft' | 'published' | 'archived'
    publishedAt: string | null
    updatedAt: string
    publicPath: string
  } | null
  landing: {
    inquiries_24h: number
    inquiries_7d: number
    recent: { id: string; full_name: string; created_at: string }[]
  } | null
  summary: {
    appointments_today: number
    open_minutes: number
    revenue_cents: number
    cancellations_24h: number
  } | null
  alerts: { type: string; id: string; title: string; at: string }[]
}

function siteStatusLabel(status: NonNullable<DashboardPayload['site']>['status']): string {
  if (status === 'published') return 'En línea'
  if (status === 'archived') return 'Archivado'
  return 'Borrador'
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function SuiteHomePage({ tenant }: { tenant: SuiteTenant }) {
  const hasBooking = tenant.modules.includes('reservas')
  const hasSitio = tenant.modules.includes('sitio')
  const hasInventario = tenant.modules.includes('inventario')
  const upgradeHref = suiteUpgradeBookingHref({
    businessName: tenant.businessName,
    email: tenant.email,
  })
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await suiteFetch(SUITE_DASHBOARD_API)
      const body = (await res.json().catch(() => ({}))) as DashboardPayload & { error?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo cargar el panel')
      setData(body)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Panel · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Hoy</h1>
            <p className="text-sm text-white/60">Lo urgente de tu negocio en un vistazo.</p>
          </div>
          {hasSitio ? (
            <Button asChild size="lg" className="min-w-[10rem]">
              <Link href={SUITE_SITIO_PATH}>Editar mi sitio</Link>
            </Button>
          ) : null}
        </div>

        {loading ? <p className="text-sm text-white/60">Cargando…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {!loading && data ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Estado del sitio"
                value={data.site ? siteStatusLabel(data.site.status) : 'Sin sitio'}
              />
              <Stat
                label="Solicitudes (24 h)"
                value={String(data.landing?.inquiries_24h ?? 0)}
              />
              <Stat
                label="Solicitudes (7 d)"
                value={String(data.landing?.inquiries_7d ?? 0)}
              />
            </div>

            {data.site ? (
              <div className="flex flex-wrap gap-2">
                {hasSitio ? (
                  <QuickLink href={SUITE_SITIO_PATH} label="Editar mi sitio" primary />
                ) : null}
                {hasInventario ? (
                  <QuickLink href={SUITE_INVENTARIO_PATH} label="Inventario" />
                ) : null}
                {data.site.status === 'published' ? (
                  <a
                    href={data.site.publicPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10"
                  >
                    Ver página pública
                  </a>
                ) : hasSitio ? (
                  <QuickLink href={SUITE_SITIO_PATH} label="Publicar sitio" />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                Todavía no tenés un sitio. Si acabás de registrarte, esperá la invitación o
                contactá soporte.
              </p>
            )}

            {!hasBooking ? (
              <BookingUpsell
                upgradeHref={upgradeHref}
                businessName={tenant.businessName}
              />
            ) : null}

            {hasBooking && data.summary ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat label="Citas hoy" value={String(data.summary.appointments_today)} />
                  <Stat
                    label="Huecos libres"
                    value={`${Math.floor(data.summary.open_minutes / 60)} h ${data.summary.open_minutes % 60} m`}
                  />
                  <Stat
                    label="Ingreso estimado"
                    value={formatLempirasFromCents(data.summary.revenue_cents)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <QuickLink href={`${SUITE_RESERVAS_PATH}?new=1`} label="Crear cita manual" primary />
                  <QuickLink href={`${SUITE_RESERVAS_PATH}?block=1`} label="Bloquear horario" />
                  <QuickLink href={`${SUITE_SITIO_PATH}?tab=negocio`} label="Horario de cierre" />
                  <QuickLink href={SUITE_EQUIPO_PATH} label="Equipo" />
                </div>
              </>
            ) : null}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-white/80">Actividad reciente</h2>
              {data.site ? (
                <p className="text-xs text-white/40">
                  Sitio actualizado {formatDateTimeForHonduras(data.site.updatedAt)}
                </p>
              ) : null}
              {data.alerts.length === 0 && (!data.landing || data.landing.recent.length === 0) ? (
                <p className="text-sm text-white/50">
                  Sin solicitudes nuevas. Cuando alguien escriba desde tu página, aparece acá.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(data.alerts.length > 0
                    ? data.alerts
                    : (data.landing?.recent ?? []).map((row) => ({
                        type: 'inquiry',
                        id: row.id,
                        title: `Solicitud: ${row.full_name}`,
                        at: row.created_at,
                      }))
                  ).map((alert) => (
                    <li
                      key={`${alert.type}-${alert.id}`}
                      className="glass-modern rounded-xl px-3 py-2 text-sm"
                    >
                      <p>{alert.title}</p>
                      <p className="text-xs text-white/40">
                        {formatDateTimeForHonduras(alert.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </SuiteShell>
  )
}

function BookingUpsell({
  upgradeHref,
  businessName,
}: {
  upgradeHref: string | null
  businessName: string
}) {
  return (
    <section className="glass-modern overflow-hidden rounded-2xl border border-cyan-400/25">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">
            Módulo disponible
          </p>
          <h2 className="text-base font-semibold text-white">
            Activá reservas para que {businessName} agende 24/7
          </h2>
          <p className="text-sm text-white/65">
            El módulo de reservas no está en tu plan. Con agenda, equipo y bloqueos tus
            clientes piden cita desde la página — sin depender solo del WhatsApp.
          </p>
          {upgradeHref ? (
            <Button asChild className="btn-shiny">
              <a href={upgradeHref} target="_blank" rel="noopener noreferrer">
                Activar reservas
              </a>
            </Button>
          ) : (
            <p className="text-sm text-white/50">
              Pedí a soporte que active <span className="font-mono text-white/70">booking</span>{' '}
              en tu lead.
            </p>
          )}
        </div>
        <BookingPreviewSkeleton />
      </div>
    </section>
  )
}

/** Placeholder visual — no son métricas reales. */
function BookingPreviewSkeleton() {
  return (
    <div
      className="relative border-t border-white/10 bg-black/20 p-4 lg:border-l lg:border-t-0"
      aria-hidden
    >
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-white/35">
        Vista previa del módulo
      </p>
      <div className="space-y-2 opacity-60">
        {['10:00 · Corte', '11:30 · Barba', '15:00 · Color'].map((label) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-2 text-xs text-white/50"
          >
            <span>{label}</span>
            <span className="h-2 w-10 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-modern rounded-xl px-3 py-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-cyan-300">{value}</p>
    </div>
  )
}

function QuickLink({
  href,
  label,
  primary = false,
}: {
  href: string
  label: string
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'rounded-xl border border-brand-400/40 bg-brand-600/25 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600/35'
          : 'glass rounded-xl px-4 py-3 text-sm font-medium text-white/90 hover:border-white/35'
      }
    >
      {label}
    </Link>
  )
}
