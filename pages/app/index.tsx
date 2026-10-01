import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../components/suite/SuiteShell'
import { suiteFetch } from '../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../lib/suite/tenant'
import {
  SUITE_DASHBOARD_API,
  SUITE_EQUIPO_PATH,
  SUITE_RESERVAS_PATH,
  SUITE_SITIO_PATH,
} from '../../lib/suite/paths'
import { formatLempirasFromCents } from '../../lib/suite/schemas'
import { formatDateTimeForHonduras } from '../../lib/timezone'

interface DashboardPayload {
  day: string
  summary: {
    appointments_today: number
    open_minutes: number
    revenue_cents: number
    cancellations_24h: number
  }
  alerts: { type: string; id: string; title: string; at: string }[]
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function SuiteHomePage({ tenant }: { tenant: SuiteTenant }) {
  const hasBooking = tenant.modules.includes('reservas')
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(hasBooking)

  const load = useCallback(async () => {
    if (!hasBooking) return
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
  }, [hasBooking])

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
        <div>
          <h1 className="text-xl font-semibold">Hoy</h1>
          <p className="text-sm text-white/60">Lo urgente de tu negocio en un vistazo.</p>
        </div>

        {!hasBooking ? (
          <p className="text-sm text-white/70">
            El módulo de reservas no está activo en tu plan. Si contrataste landing, podés editar{' '}
            <Link href={SUITE_SITIO_PATH} className="text-sky-200 underline">
              Mi sitio
            </Link>
            .
          </p>
        ) : null}

        {hasBooking && loading ? <p className="text-sm text-white/60">Cargando…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {hasBooking && data ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Citas hoy" value={String(data.summary.appointments_today)} />
              <Stat
                label="Huecos libres"
                value={`${Math.floor(data.summary.open_minutes / 60)} h ${data.summary.open_minutes % 60} m`}
              />
              <Stat label="Ingreso estimado" value={formatLempirasFromCents(data.summary.revenue_cents)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <QuickLink href={`${SUITE_RESERVAS_PATH}?new=1`} label="Crear cita manual" />
              <QuickLink href={`${SUITE_RESERVAS_PATH}?block=1`} label="Bloquear horario" />
              <QuickLink href={`${SUITE_SITIO_PATH}?tab=negocio`} label="Horario de cierre" />
              <QuickLink href={SUITE_EQUIPO_PATH} label="Equipo" />
            </div>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-white/80">Notificaciones</h2>
              {data.alerts.length === 0 ? (
                <p className="text-sm text-white/50">Sin alertas en las últimas 24 h.</p>
              ) : (
                <ul className="space-y-2">
                  {data.alerts.map((alert) => (
                    <li key={`${alert.type}-${alert.id}`} className="rounded border border-white/10 bg-slate-900/50 px-3 py-2 text-sm">
                      <p>{alert.title}</p>
                      <p className="text-xs text-white/40">{formatDateTimeForHonduras(alert.at)}</p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-slate-900/60 px-3 py-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 hover:bg-sky-500/20"
    >
      {label}
    </Link>
  )
}
