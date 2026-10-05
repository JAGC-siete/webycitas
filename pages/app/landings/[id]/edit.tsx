import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ExternalLink, Eye, Globe, Inbox, Loader2, Save } from 'lucide-react'
import SuperAdminGuard from '../../../../components/auth/SuperAdminGuard'
import LandingRenderer from '../../../../components/landings/LandingRenderer'
import {
  asEditorControls,
  BlockAccordion,
  GlobalFields,
  fieldErrorMessage,
  type EditableBlockRef,
  type EditorFormValues,
} from '../../../../components/landings/editor/LandingEditorPanel'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent } from '../../../../components/ui/card'
import { Input } from '../../../../components/ui/input'
import { requireSuperAdminPage } from '../../../../lib/auth/api-auth'
import {
  fetchLanding,
  publishLanding,
  saveLanding,
  type LandingEditRecord,
} from '../../../../lib/landings/admin-api'
import { editorFormSchema } from '../../../../lib/landings/editor-form'
import { readLandingPageContent } from '../../../../lib/landings/page-schema'
import {
  LANDINGS_ADMIN_PATH,
  landingAdminLeadsPath,
  landingPublicPath,
} from '../../../../lib/landings/paths'
import { formatDateTimeForHonduras } from '../../../../lib/timezone'
import type {
  LandingPageContent,
  LandingPageContentInput,
  LandingPageStatus,
  PublicLandingPage,
} from '../../../../types/landing'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuperAdminPage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: {} }
}

const PreviewPane = memo(function PreviewPane({
  control,
  landingId,
  slug,
  title,
  templateType,
}: {
  control: Control<EditorFormValues>
  landingId: string
  slug: string
  title: string
  templateType?: string
}) {
  const values = useWatch({ control })
  const lastValidPreview = useRef<LandingPageContent | null>(null)

  const preview = useMemo(() => {
    const read = readLandingPageContent(values as LandingPageContentInput)
    if (read.ok) {
      lastValidPreview.current = read.content
      return {
        page: {
          id: landingId,
          slug,
          title,
          templateType: templateType ?? 'papeleria',
          content: read.content,
        } as PublicLandingPage,
        stale: false,
      }
    }
    if (!lastValidPreview.current) return { page: null, stale: false }
    return {
      page: {
        id: landingId,
        slug,
        title,
        templateType: templateType ?? 'papeleria',
        content: lastValidPreview.current,
      } as PublicLandingPage,
      stale: true,
    }
  }, [values, landingId, slug, title, templateType])

  return (
    <div className="sticky top-6 space-y-2">
      {preview.stale && (
        <p className="animate-pulse text-xs text-amber-300">
          Vista previa en pausa: hay un campo incompleto. Se muestra la última versión válida.
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50 shadow-2xl">
        {preview.page ? (
          <div className="max-h-[82vh] overflow-y-auto">
            <LandingRenderer page={preview.page} />
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-gray-400">
            Completa los datos básicos para ver la vista previa.
          </div>
        )}
      </div>
    </div>
  )
})

function EditorContent({ landingId }: { landingId: string }) {
  const router = useRouter()
  const [record, setRecord] = useState<LandingEditRecord | null>(null)
  const [status, setStatus] = useState<LandingPageStatus>('draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [showPreview, setShowPreview] = useState(true)

  const form = useForm<EditorFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod preprocess + RHF resolver generics
    resolver: zodResolver(editorFormSchema as any),
    mode: 'onSubmit',
  })

  const { handleSubmit, reset, register, control, watch, formState } = form
  const controls = asEditorControls(form)
  const { errors, isDirty } = formState

  const currentTitle = watch('_title') ?? ''
  const currentSlug = watch('_slug') ?? ''
  const blocks = (watch('blocks') ?? []) as EditableBlockRef[]

  useEffect(() => {
    let active = true
    const loadData = async () => {
      try {
        const { landing } = await fetchLanding(landingId)
        if (!active) return

        const parsed = readLandingPageContent(landing.content_json)
        if (!parsed.ok) {
          setMessage({ tone: 'error', text: `El borrador guardado no se pudo leer: ${parsed.reason}` })
          setLoading(false)
          return
        }

        setRecord(landing)
        setStatus(landing.status)
        reset({
          ...parsed.content,
          _title: landing.title,
          _slug: landing.slug,
          _notifyEmail: landing.lead_notify_email ?? '',
        })
      } catch (err: unknown) {
        if (active) {
          setMessage({
            tone: 'error',
            text: err instanceof Error ? err.message : 'No se pudo cargar la landing',
          })
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()
    return () => {
      active = false
    }
  }, [landingId, reset])

  const persistDraft = useCallback(
    async (formData: EditorFormValues) => {
      const { _title, _slug, _notifyEmail, ...contentData } = formData
      const content = contentData as LandingPageContent
      const saved = await saveLanding(landingId, {
        title: (_title ?? '').trim(),
        slug: (_slug ?? '').trim(),
        leadNotifyEmail: _notifyEmail?.trim() || null,
        content,
      })
      setRecord(saved.landing)
      setStatus(saved.landing.status)
      reset({
        ...content,
        _title: saved.landing.title,
        _slug: saved.landing.slug,
        _notifyEmail: saved.landing.lead_notify_email ?? '',
      })
      return saved.landing
    },
    [landingId, reset]
  )

  const onSave = useCallback(
    async (formData: EditorFormValues) => {
      setSaving(true)
      setMessage(null)
      try {
        await persistDraft(formData)
        setMessage({ tone: 'ok', text: 'Borrador guardado exitosamente.' })
      } catch (err: unknown) {
        setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo guardar' })
      } finally {
        setSaving(false)
      }
    },
    [persistDraft]
  )

  const onPublishAction = useCallback(
    async (action: 'publish' | 'unpublish') => {
      setPublishing(true)
      setMessage(null)
      try {
        if (action === 'publish') {
          await new Promise<void>((resolve, reject) => {
            void handleSubmit(
              async (formData) => {
                try {
                  await persistDraft(formData)
                  const result = await publishLanding(landingId, 'publish')
                  setStatus(result.status)
                  setMessage({
                    tone: 'ok',
                    text: 'Publicada. Ya se puede abrir la dirección pública.',
                  })
                  resolve()
                } catch (err) {
                  reject(err)
                }
              },
              () => {
                reject(new Error('Hay campos inválidos. Corrígelos antes de publicar.'))
              }
            )()
          })
          return
        }

        const result = await publishLanding(landingId, 'unpublish')
        setStatus(result.status)
        setMessage({
          tone: 'ok',
          text: 'Despublicada. La dirección pública deja de responder.',
        })
      } catch (err: unknown) {
        setMessage({
          tone: 'error',
          text: err instanceof Error ? err.message : 'No se pudo cambiar la publicación',
        })
      } finally {
        setPublishing(false)
      }
    },
    [handleSubmit, landingId, persistDraft]
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-gray-300">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Cargando el editor…</span>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-md px-6 py-12 text-center">
        <p className="text-sm text-red-400">{message?.text ?? 'Landing no encontrada'}</p>
        <Button variant="outline" className="mt-4" onClick={() => void router.push(LANDINGS_ADMIN_PATH)}>
          Volver al listado
        </Button>
      </div>
    )
  }

  const hasErrors = Object.keys(errors).length > 0
  const busy = saving || publishing

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Link href={LANDINGS_ADMIN_PATH}>
            <Button variant="ghost" size="icon" aria-label="Volver al listado">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{currentTitle || 'Sin título'}</h1>
            <p className="font-mono text-xs text-gray-400">{landingPublicPath(currentSlug)}</p>
          </div>
          <Badge
            className={
              status === 'published'
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                : status === 'draft'
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                  : 'border-gray-500/30 bg-gray-500/15 text-gray-400'
            }
          >
            {status === 'published' ? 'Publicada' : status === 'draft' ? 'Borrador' : 'Archivada'}
          </Badge>
          {isDirty ? (
            <Badge className="border-sky-500/30 bg-sky-500/15 text-sky-200">Sin guardar</Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={landingAdminLeadsPath(landingId)}>
            <Button variant="ghost" size="sm">
              <Inbox className="mr-2 h-4 w-4" />
              Consultas
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview((prev) => !prev)}>
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
          </Button>
          <Button onClick={handleSubmit(onSave)} disabled={busy} size="sm">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          {status === 'published' ? (
            <>
              <a href={landingPublicPath(currentSlug)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </Button>
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onPublishAction('unpublish')}
                disabled={busy}
              >
                Despublicar
              </Button>
            </>
          ) : (
            <Button
              variant="modern"
              size="sm"
              onClick={() => void onPublishAction('publish')}
              disabled={busy}
            >
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
              {publishing ? 'Publicando…' : 'Publicar'}
            </Button>
          )}
        </div>
      </header>

      {message && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            message.tone === 'ok'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {hasErrors && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300">
          Hay campos inválidos. Los paneles con error se abrieron automáticamente.
        </div>
      )}

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-[400px_1fr]' : 'grid-cols-1'}`}>
        <div className="space-y-4">
          <Card variant="glass">
            <CardContent className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-300">Título interno</span>
                <Input {...register('_title')} className="bg-white/10 text-white" />
                {fieldErrorMessage(errors, '_title') ? (
                  <span className="mt-1 block text-xs text-red-400">{fieldErrorMessage(errors, '_title')}</span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-300">Dirección pública</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">/p/</span>
                  <Input {...register('_slug')} className="bg-white/10 text-white" />
                </div>
                {fieldErrorMessage(errors, '_slug') ? (
                  <span className="mt-1 block text-xs text-red-400">{fieldErrorMessage(errors, '_slug')}</span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-300">
                  Correo para avisos de leads
                </span>
                <Input
                  {...register('_notifyEmail')}
                  placeholder="dueno@negocio.hn"
                  className="bg-white/10 text-white placeholder:text-gray-500"
                />
                {fieldErrorMessage(errors, '_notifyEmail') ? (
                  <span className="mt-1 block text-xs text-red-400">
                    {fieldErrorMessage(errors, '_notifyEmail')}
                  </span>
                ) : (
                  <span className="mt-1 block text-xs text-gray-500">
                    Si lo dejas vacío, el aviso llega al correo de quien creó la página.
                  </span>
                )}
              </label>
              {record.published_at && (
                <p className="pt-1 text-xs text-gray-500">
                  Última publicación: {formatDateTimeForHonduras(new Date(record.published_at))}
                </p>
              )}
            </CardContent>
          </Card>

          <GlobalFields register={controls.register} control={controls.control} errors={errors} />
          <BlockAccordion
            blocks={blocks}
            control={controls.control}
            register={controls.register}
            errors={errors}
          />
        </div>

        {showPreview && (
          <PreviewPane
            control={control}
            landingId={landingId}
            slug={currentSlug}
            title={currentTitle}
            templateType={record.template_type}
          />
        )}
      </div>
    </div>
  )
}

export default function LandingEditorPage() {
  const router = useRouter()
  const rawId = router.query.id
  const landingId = Array.isArray(rawId) ? rawId[0] : rawId

  return (
    <SuperAdminGuard redirectPath="/app">
      <Head>
        <title>Editor de página | Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-slate-950 text-white">
        {landingId ? (
          <EditorContent landingId={landingId} />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-gray-300">Cargando…</div>
        )}
      </div>
    </SuperAdminGuard>
  )
}
