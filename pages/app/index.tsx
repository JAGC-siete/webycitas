import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../components/suite/SuiteShell'
import Notices from '../../components/suite/Notices'
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
import { buildActivityFeed } from '../../lib/suite/activity'
import { formatLempirasFromCents } from '../../lib/suite/schemas'
import { shouldOfferBookingUpgrade, suiteUpgradeBookingHref } from '../../lib/suite/upgrade'
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
  const canUpgradeBooking = shouldOfferBookingUpgrade(tenant)
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

  const activity = data ? buildActivityFeed(data.alerts, data.landing?.recent ?? []) : []

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

        <Notices notice={null} error={error} onRetry={() => void load()} />

        {loading ? <DashboardSkeleton withBooking={hasBooking} /> : null}

        {!loading && data ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Estado del sitio"
                value={data.site ? siteStatusLabel(data.site.status) : 'Sin sitio'}
              />
              <Stat
                label="Mensajes (últimas 24 h)"
                value={String(data.landing?.inquiries_24h ?? 0)}
              />
              <Stat
                label="Mensajes (últimos 7 días)"
                value={String(data.landing?.inquiries_7d ?? 0)}
              />
            </div>

            {data.site ? (
              <div className="flex flex-wrap gap-2">
                {data.site.status === 'published' ? (
                  <QuickLink href={data.site.publicPath} label="Ver mi página" external />
                ) : hasSitio ? (
                  <QuickLink href={SUITE_SITIO_PATH} label="Publicar mi página" primary />
                ) : null}
                {hasInventario ? <QuickLink href={SUITE_INVENTARIO_PATH} label="Inventario" /> : null}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                Todavía no tienes un sitio. Si acabas de registrarte, espera la invitación o
                escríbenos a soporte.
              </p>
            )}

            {canUpgradeBooking ? (
              <BookingUpsell
                upgradeHref={upgradeHref}
                businessName={tenant.businessName}
                rubro={tenant.rubro}
              />
            ) : null}

            {hasBooking && data.summary ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat label="Citas hoy" value={String(data.summary.appointments_today)} />
                  <Stat
                    label="Tiempo libre hoy"
                    value={`${Math.floor(data.summary.open_minutes / 60)} h ${data.summary.open_minutes % 60} min`}
                  />
                  <Stat
                    label="Ingreso estimado hoy"
                    value={formatLempirasFromCents(data.summary.revenue_cents)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <QuickLink href={SUITE_RESERVAS_PATH} label="Ver agenda" primary />
                  <QuickLink href={`${SUITE_RESERVAS_PATH}?new=1`} label="Nueva cita" />
                  <QuickLink href={`${SUITE_RESERVAS_PATH}?block=1`} label="Bloquear horario" />
                  <QuickLink href={SUITE_EQUIPO_PATH} label="Equipo y horarios" />
                </div>
              </>
            ) : null}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-white/80">Actividad reciente</h2>
              {activity.length === 0 ? (
                <p className="text-sm text-white/50">
                  Sin mensajes nuevos. Cuando alguien te escriba desde tu página, aparece aquí.
                </p>
              ) : (
                <ul className="space-y-2">
                  {activity.map((item) => {
                    const content = (
                      <>
                        <span>
                          <span className="block">{item.title}</span>
                          <span className="text-xs text-white/50">
                            {item.kind === 'cancellation' ? 'Era para el ' : ''}
                            {formatDateTimeForHonduras(item.at)}
                          </span>
                        </span>
                        {hasBooking ? (
                          <span className="text-xs text-sky-200">
                            {item.kind === 'inquiry' ? 'Agendar →' : 'Ver agenda →'}
                          </span>
                        ) : null}
                      </>
                    )
                    return (
                      <li key={item.key}>
                        {hasBooking ? (
                          <Link
                            href={SUITE_RESERVAS_PATH}
                            className="glass-modern flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition hover:border-brand-400/40"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className="glass-modern flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm">
                            {content}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {data.site ? (
                <p className="text-xs text-white/55">
                  Tu página se actualizó el {formatDateTimeForHonduras(data.site.updatedAt)}
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </SuiteShell>
  )
}

function DashboardSkeleton({ withBooking }: { withBooking: boolean }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando el panel">
      {[0, withBooking ? 1 : null].filter((row) => row !== null).map((row) => (
        <div key={row} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((cell) => (
            <div key={cell} className="glass-modern h-[4.5rem] animate-pulse rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

function BookingUpsell({
  upgradeHref,
  businessName,
  rubro,
}: {
  upgradeHref: string | null
  businessName: string
  rubro: string
}) {
  return (
    <section className="glass-modern overflow-hidden rounded-2xl border border-cyan-400/25">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">
            Módulo disponible
          </p>
          <h2 className="text-base font-semibold text-white">
            Activa reservas para que {businessName} agende 24/7
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
            <p className="text-sm text-white/50">Escríbenos a soporte para activar reservas.</p>
          )}
        </div>
        <BookingPreviewSkeleton rubro={rubro} />
      </div>
    </section>
  )
}

const PREVIEW_SLOTS: Record<string, string[]> = {
  barberia: ['10:00 · Corte', '11:30 · Barba', '15:00 · Fade'],
  salon: ['10:00 · Corte', '11:30 · Tinte', '15:00 · Peinado'],
  spa: ['10:00 · Masaje', '11:30 · Facial', '15:00 · Manicure'],
  clinica: ['10:00 · Consulta', '11:30 · Control', '15:00 · Limpieza'],
}
const DEFAULT_PREVIEW_SLOTS = ['10:00 · Cita', '11:30 · Cita', '15:00 · Cita']

/** Placeholder visual — no son métricas reales. */
function BookingPreviewSkeleton({ rubro }: { rubro: string }) {
  return (
    <div
      className="relative border-t border-white/10 bg-black/20 p-4 lg:border-l lg:border-t-0"
      aria-hidden
    >
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-white/55">
        Vista previa del módulo
      </p>
      <div className="space-y-2 opacity-60">
        {(PREVIEW_SLOTS[rubro] ?? DEFAULT_PREVIEW_SLOTS).map((label) => (
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
  external = false,
}: {
  href: string
  label: string
  primary?: boolean
  external?: boolean
}) {
  const className = primary
    ? 'rounded-xl border border-brand-400/40 bg-brand-600/25 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600/35'
    : 'glass rounded-xl px-4 py-3 text-sm font-medium text-white/90 hover:border-white/35'
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label} ↗
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  )
}
