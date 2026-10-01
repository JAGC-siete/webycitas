import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import SuiteShell from '../../../components/suite/SuiteShell'
import { suiteFetch } from '../../../lib/auth/client-session'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'
import {
  SUITE_SERVICES_API,
  SUITE_SITE_CONTENT_API,
  SUITE_SITE_PUBLISH_API,
  SUITE_STAFF_API,
} from '../../../lib/suite/paths'
import { formatLempirasFromCents } from '../../../lib/suite/schemas'

type Tab = 'servicios' | 'negocio' | 'galeria' | 'equipo'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'sitio' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function SitioPage({ tenant }: { tenant: SuiteTenant }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('servicios')
  const [title, setTitle] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [content, setContent] = useState<Record<string, unknown> | null>(null)
  const [slug, setSlug] = useState('')
  const [services, setServices] = useState<
    { id: string; name: string; price_cents: number; duration_min: number; is_active: boolean }[]
  >([])
  const [staff, setStaff] = useState<{ id: string; name: string; bio: string | null }[]>([])
  const [svcForm, setSvcForm] = useState({ name: '', price: '150', duration: '30' })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const raw = router.query.tab
    if (raw === 'negocio' || raw === 'galeria' || raw === 'equipo' || raw === 'servicios') setTab(raw)
  }, [router.query.tab])

  const load = useCallback(async () => {
    const [siteRes, svcRes, staffRes] = await Promise.all([
      suiteFetch(SUITE_SITE_CONTENT_API),
      suiteFetch(SUITE_SERVICES_API),
      suiteFetch(SUITE_STAFF_API).catch(() => null),
    ])
    const siteBody = (await siteRes.json()) as {
      site?: {
        title: string
        slug: string
        lead_notify_email: string | null
        content_json: Record<string, unknown>
      }
      error?: string
    }
    if (!siteRes.ok) {
      setError(siteBody.error || 'No se pudo cargar el sitio')
      return
    }
    if (siteBody.site) {
      setTitle(siteBody.site.title)
      setSlug(siteBody.site.slug)
      setNotifyEmail(siteBody.site.lead_notify_email || '')
      setContent(siteBody.site.content_json)
      const business = (siteBody.site.content_json as { business?: Record<string, string> }).business
      if (business) {
        setWhatsapp(business.whatsapp || '')
        setPhone(business.phone || '')
        setAddress(business.address || '')
      }
    }
    const svcBody = (await svcRes.json()) as { services?: typeof services }
    setServices(svcBody.services ?? [])
    if (staffRes && staffRes.ok) {
      const staffBody = (await staffRes.json()) as { staff?: typeof staff }
      setStaff(staffBody.staff ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveBusiness() {
    if (!content) return
    const next = structuredClone(content) as {
      business?: Record<string, string>
      blocks?: { kind: string; rows?: { label: string; value: string }[] }[]
    }
    next.business = {
      ...(next.business || {}),
      name: tenant.businessName,
      whatsapp: whatsapp,
      phone: phone,
      address: address,
    }
    const res = await suiteFetch(SUITE_SITE_CONTENT_API, {
      method: 'PATCH',
      body: JSON.stringify({
        title,
        lead_notify_email: notifyEmail || null,
        content_json: next,
      }),
    })
    const body = (await res.json()) as { error?: string }
    if (!res.ok) {
      setError(body.error || 'No se pudo guardar')
      return
    }
    setNotice('Negocio actualizado')
    setContent(next as Record<string, unknown>)
  }

  async function addService() {
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
    setNotice('Servicio agregado')
    void load()
  }

  async function removeService(id: string) {
    const res = await suiteFetch(`${SUITE_SERVICES_API}?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      setError(body.error || 'No se pudo eliminar')
      return
    }
    void load()
  }

  async function publish() {
    const res = await suiteFetch(SUITE_SITE_PUBLISH_API, { method: 'POST', body: '{}' })
    const body = (await res.json()) as { error?: string; preview?: string }
    if (!res.ok) {
      setError(body.error || 'No se pudo publicar')
      return
    }
    setNotice(`Publicado. Vista: ${body.preview || `/p/${slug}`}`)
  }

  const gallery =
    ((content as { blocks?: { kind: string; images?: { url: string; alt?: string }[] }[] } | null)?.blocks || []).find(
      (b) => b.kind === 'gallery'
    )?.images || []

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Mi sitio · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Mi sitio</h1>
          <div className="flex gap-3 text-sm">
            {slug ? (
              <Link href={`/p/${slug}`} className="text-sky-200 hover:underline" target="_blank">
                Vista previa
              </Link>
            ) : null}
            <button type="button" className="rounded bg-emerald-500/30 px-3 py-1" onClick={() => void publish()}>
              Publicar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {(['servicios', 'negocio', 'galeria', 'equipo'] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`rounded px-3 py-1 ${tab === key ? 'bg-sky-500/30' : 'bg-white/5'}`}
              onClick={() => setTab(key)}
            >
              {key}
            </button>
          ))}
        </div>

        {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {tab === 'servicios' ? (
          <section className="space-y-3">
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
              <button type="button" className="rounded bg-sky-500/30 px-3 py-1 text-sm" onClick={() => void addService()}>
                Agregar
              </button>
            </div>
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm">
                  <span>
                    {s.name} · {formatLempirasFromCents(s.price_cents)} · {s.duration_min} min
                  </span>
                  <button type="button" className="text-red-300 underline" onClick={() => void removeService(s.id)}>
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === 'negocio' ? (
          <section className="space-y-3 max-w-md">
            <Field label="Título del sitio" value={title} onChange={setTitle} />
            <Field label="WhatsApp receptor" value={whatsapp} onChange={setWhatsapp} />
            <Field label="Teléfono" value={phone} onChange={setPhone} />
            <Field label="Dirección" value={address} onChange={setAddress} />
            <Field label="Email de avisos" value={notifyEmail} onChange={setNotifyEmail} />
            <button type="button" className="rounded bg-sky-500/30 px-3 py-2 text-sm" onClick={() => void saveBusiness()}>
              Guardar
            </button>
          </section>
        ) : null}

        {tab === 'galeria' ? (
          <section className="space-y-2">
            <p className="text-sm text-white/60">
              Las imágenes vienen del borrador del site. Subí URLs https en el bloque gallery del contenido (upload
              Storage en una siguiente iteración).
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gallery.map((img, idx) => (
                <li key={`${img.url}-${idx}`} className="overflow-hidden rounded border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt || ''} className="h-28 w-full object-cover" />
                </li>
              ))}
              {gallery.length === 0 ? <li className="text-sm text-white/50">Sin fotos todavía.</li> : null}
            </ul>
          </section>
        ) : null}

        {tab === 'equipo' ? (
          <section className="space-y-2">
            <p className="text-sm text-white/60">Bios del equipo (vinculadas a Agenda → Equipo).</p>
            <ul className="space-y-2">
              {staff.map((member) => (
                <li key={member.id} className="rounded border border-white/10 px-3 py-2 text-sm">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-white/50">{member.bio || 'Sin bio'}</p>
                </li>
              ))}
              {staff.length === 0 ? <li className="text-sm text-white/50">Agregá miembros en Agenda → Equipo.</li> : null}
            </ul>
          </section>
        ) : null}
      </div>
    </SuiteShell>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block text-xs text-white/60">
      {label}
      <input
        className="mt-1 w-full rounded border border-white/20 bg-slate-900 px-2 py-1 text-sm text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
