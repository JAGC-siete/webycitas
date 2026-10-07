/**
 * Shell compartido del editor split (form + preview).
 * Ops y suite inyectan transporte vía onSave / onPublish.
 */

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import Link from 'next/link'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodTypeAny } from 'zod'
import { ArrowLeft, ExternalLink, Eye, Globe, Inbox, Loader2, Save } from 'lucide-react'
import LandingRenderer from '../LandingRenderer'
import {
  asEditorControls,
  BlockAccordion,
  GlobalFields,
  fieldErrorMessage,
  type EditorFormValues,
} from './LandingEditorPanel'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardContent } from '../../ui/card'
import { Input } from '../../ui/input'
import type {
  LandingEditRecord,
  PublishLandingResult,
  SaveLandingDraftInput,
} from '../../../lib/landings/editor-types'
import { readLandingPageContent } from '../../../lib/landings/page-schema'
import { landingPublicPath } from '../../../lib/landings/paths'
import { formatDateTimeForHonduras } from '../../../lib/timezone'
import type {
  LandingPageContent,
  LandingPageContentInput,
  LandingPageStatus,
  PublicLandingPage,
} from '../../../types/landing'

export interface LandingSplitEditorProps {
  landingId: string
  initial: LandingEditRecord
  formSchema: ZodTypeAny
  slugEditable: boolean
  canUnpublish: boolean
  backHref?: string
  leadsHref?: string
  onSave: (input: SaveLandingDraftInput) => Promise<LandingEditRecord>
  onPublish: (action: 'publish' | 'unpublish') => Promise<PublishLandingResult>
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

export default function LandingSplitEditor({
  landingId,
  initial,
  formSchema,
  slugEditable,
  canUnpublish,
  backHref,
  leadsHref,
  onSave,
  onPublish,
}: LandingSplitEditorProps) {
  const [record, setRecord] = useState<LandingEditRecord>(initial)
  const [status, setStatus] = useState<LandingPageStatus>(initial.status)
  const [unpublished, setUnpublished] = useState(initial.has_unpublished_changes ?? false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)

  const form = useForm<EditorFormValues>({
    // Zod preprocess + RHF resolver generics
    resolver: zodResolver(formSchema as never),
    mode: 'onSubmit',
  })

  const { handleSubmit, reset, register, control, watch, formState } = form
  const controls = asEditorControls(form)
  const { errors, isDirty } = formState

  const currentTitle = watch('_title') ?? ''
  const currentSlug = watch('_slug') ?? record.slug

  useEffect(() => {
    const parsed = readLandingPageContent(initial.content_json)
    if (!parsed.ok) {
      setBootError(`El borrador guardado no se pudo leer: ${parsed.reason}`)
      return
    }
    setBootError(null)
    setRecord(initial)
    setStatus(initial.status)
    setUnpublished(initial.has_unpublished_changes ?? false)
    reset({
      ...parsed.content,
      _title: initial.title,
      _slug: initial.slug,
      _notifyEmail: initial.lead_notify_email ?? '',
    })
  }, [initial, reset])

  const persistDraft = useCallback(
    async (formData: EditorFormValues) => {
      const { _title, _slug, _notifyEmail, ...contentData } = formData
      const content = contentData as LandingPageContent
      const saved = await onSave({
        title: (_title ?? '').trim(),
        slug: slugEditable ? (_slug ?? '').trim() : undefined,
        leadNotifyEmail: _notifyEmail?.trim() || null,
        content,
      })
      setRecord(saved)
      setStatus(saved.status)
      setUnpublished(saved.has_unpublished_changes ?? saved.status === 'published')
      reset({
        ...content,
        _title: saved.title,
        _slug: saved.slug,
        _notifyEmail: saved.lead_notify_email ?? '',
      })
      return saved
    },
    [onSave, reset, slugEditable]
  )

  const handleSave = useCallback(
    async (formData: EditorFormValues) => {
      setSaving(true)
      setMessage(null)
      try {
        const saved = await persistDraft(formData)
        setMessage({
          tone: 'ok',
          text:
            saved.status === 'published'
              ? 'Guardado. Toca «Publicar cambios» para que se vea en tu página.'
              : 'Borrador guardado exitosamente.',
        })
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
          const wasPublished = status === 'published'
          await new Promise<void>((resolve, reject) => {
            void handleSubmit(
              async (formData) => {
                try {
                  await persistDraft(formData)
                  const result = await onPublish('publish')
                  setStatus(result.status)
                  setUnpublished(false)
                  setMessage({
                    tone: 'ok',
                    text: wasPublished
                      ? 'Cambios publicados. Ya se ven en tu página.'
                      : 'Publicada. Ya se puede abrir la dirección pública.',
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

        if (!canUnpublish) {
          throw new Error('No tenés permiso para despublicar')
        }
        const result = await onPublish('unpublish')
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
    [canUnpublish, handleSubmit, onPublish, persistDraft, status]
  )

  if (bootError) {
    return (
      <div className="mx-auto max-w-md px-6 py-12 text-center">
        <p className="text-sm text-red-400">{bootError}</p>
        {backHref ? (
          <Link href={backHref} className="mt-4 inline-block text-sm text-sky-200 hover:underline">
            Volver
          </Link>
        ) : null}
      </div>
    )
  }

  const hasErrors = Object.keys(errors).length > 0
  const busy = saving || publishing
  const pendingPublish = isDirty || unpublished

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link href={backHref}>
              <Button variant="ghost" size="icon" aria-label="Volver">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          ) : null}
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
          ) : unpublished ? (
            <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">Cambios sin publicar</Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {leadsHref ? (
            <Link href={leadsHref}>
              <Button variant="ghost" size="sm">
                <Inbox className="mr-2 h-4 w-4" />
                Consultas
              </Button>
            </Link>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setShowPreview((prev) => !prev)}>
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
          </Button>
          <Button onClick={handleSubmit(handleSave)} disabled={busy} size="sm">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          {status === 'published' ? (
            <>
              <Button
                variant={pendingPublish ? 'modern' : 'outline'}
                size="sm"
                onClick={() => void onPublishAction('publish')}
                disabled={busy || !pendingPublish}
              >
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                {publishing ? 'Publicando…' : 'Publicar cambios'}
              </Button>
              <a href={landingPublicPath(currentSlug)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </Button>
              </a>
              {canUnpublish ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onPublishAction('unpublish')}
                  disabled={busy}
                >
                  Despublicar
                </Button>
              ) : null}
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
                  <Input
                    {...register('_slug')}
                    className="bg-white/10 text-white"
                    readOnly={!slugEditable}
                    disabled={!slugEditable}
                  />
                </div>
                {!slugEditable ? (
                  <span className="mt-1 block text-xs text-gray-500">El slug no se puede cambiar desde aquí.</span>
                ) : fieldErrorMessage(errors, '_slug') ? (
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
            control={controls.control}
            register={controls.register}
            errors={errors}
            siteId={landingId}
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
