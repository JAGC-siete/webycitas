/**
 * Campos globales + accordion de bloques para el editor ops.
 * MVP: edita campos existentes y visible; no reordena ni crea bloques.
 */

import { useEffect, useState, type ReactNode } from 'react'
import {
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
  type UseFormReturn,
} from 'react-hook-form'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent } from '../../ui/card'
import { Input } from '../../ui/input'
import type { LandingBlock, LandingPageContentInput } from '../../../types/landing'

export function fieldErrorMessage(errors: FieldErrors | undefined, path: string): string | undefined {
  if (!errors) return undefined
  const parts = path.split('.')
  let cur: unknown = errors
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  if (cur && typeof cur === 'object' && 'message' in cur) {
    const message = (cur as { message?: unknown }).message
    return typeof message === 'string' && message ? message : undefined
  }
  return undefined
}

function subtreeHasErrors(errors: FieldErrors | undefined, path: string): boolean {
  if (!errors) return false
  const parts = path.split('.')
  let cur: unknown = errors
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return false
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur !== undefined && cur !== null
}

function collectErrorMessages(node: unknown, prefix = '', out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  if ('message' in node && typeof (node as { message?: unknown }).message === 'string') {
    const message = (node as { message: string }).message
    if (message) out.push(prefix ? `${prefix}: ${message}` : message)
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'message' || key === 'type' || key === 'ref') continue
    const next = prefix ? `${prefix}.${key}` : key
    collectErrorMessages(value, next, out)
  }
  return out
}

function ErrorList({ errors, path }: { errors?: FieldErrors; path: string }) {
  if (!subtreeHasErrors(errors, path)) return null
  const parts = path.split('.')
  let cur: unknown = errors
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[part]
  }
  const messages = collectErrorMessages(cur).slice(0, 6)
  if (messages.length === 0) return null
  return (
    <ul className="space-y-1 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-300">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  )
}

export interface EditorFormValues extends LandingPageContentInput {
  _title?: string
  _slug?: string
  _notifyEmail?: string
}

export type EditableBlockRef = LandingBlock

export interface EditorControls {
  register: UseFormRegister<EditorFormValues>
  control: Control<EditorFormValues>
}

export function asEditorControls(form: UseFormReturn<EditorFormValues>): EditorControls {
  return { register: form.register, control: form.control }
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-gray-300">{children}</span>
}

function Field({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-400">{error}</span> : null}
    </label>
  )
}

const fieldClass = 'bg-white/10 text-white placeholder:text-gray-500'
const textareaClass =
  'flex min-h-[72px] w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400'

function TextArea({
  register,
  name,
  rows = 3,
}: {
  register: UseFormRegister<EditorFormValues>
  name: FieldPath<EditorFormValues>
  rows?: number
}) {
  return <textarea rows={rows} className={textareaClass} {...register(name)} />
}

function CheckboxField({
  register,
  name,
  label,
}: {
  register: UseFormRegister<EditorFormValues>
  name: FieldPath<EditorFormValues>
  label: string
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-300">
      <input type="checkbox" className="rounded border-white/20 bg-white/10" {...register(name)} />
      {label}
    </label>
  )
}

function AccordionSection({
  title,
  defaultOpen = false,
  forceOpen = false,
  hasError = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  forceOpen?: boolean
  hasError?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpen)
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
  return (
    <Card variant="glass" className={hasError ? 'ring-1 ring-red-400/50' : undefined}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {title}
          {hasError ? (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
              Error
            </span>
          ) : null}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <CardContent className="space-y-3 border-t border-white/10 p-4 pt-3">{children}</CardContent> : null}
    </Card>
  )
}

function CtaFields({
  register,
  prefix,
  label,
}: {
  register: UseFormRegister<EditorFormValues>
  prefix: `blocks.${number}.primaryCta` | `blocks.${number}.secondaryCta`
  label: string
}) {
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <p className="text-xs font-semibold text-gray-200">{label}</p>
      <Field label="Etiqueta">
        <Input {...register(`${prefix}.label`)} className={fieldClass} />
      </Field>
      <Field label="Acción">
        <select
          {...register(`${prefix}.action`)}
          className="flex h-10 w-full rounded-md border border-white/10 bg-white/10 px-3 text-sm text-white"
        >
          <option value="lead-form">Formulario</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="call">Llamar</option>
          <option value="maps">Mapas</option>
          <option value="link">Link</option>
        </select>
      </Field>
      <Field label="Href (si link)">
        <Input {...register(`${prefix}.href`)} className={fieldClass} />
      </Field>
      <Field label="Mensaje WhatsApp">
        <Input {...register(`${prefix}.message`)} className={fieldClass} />
      </Field>
    </div>
  )
}

function ArrayEditor<TName extends FieldArrayPath<EditorFormValues>>({
  control,
  register,
  name,
  label,
  renderItem,
}: {
  control: Control<EditorFormValues>
  register: UseFormRegister<EditorFormValues>
  name: TName
  label: string
  renderItem: (index: number) => ReactNode
}) {
  const { fields } = useFieldArray({ control, name })
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-200">
        {label} ({fields.length})
      </p>
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-2 rounded-lg border border-white/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">#{index + 1}</p>
          {renderItem(index)}
        </div>
      ))}
    </div>
  )
}

function BlockFields({
  index,
  kind,
  register,
  control,
}: {
  index: number
  kind: LandingBlock['kind']
  register: UseFormRegister<EditorFormValues>
  control: Control<EditorFormValues>
}) {
  const base = (
    <>
      <CheckboxField register={register} name={`blocks.${index}.visible`} label="Visible" />
      <Field label="Id bloque">
        <Input {...register(`blocks.${index}.id`)} className={fieldClass} readOnly />
      </Field>
    </>
  )

  switch (kind) {
    case 'hero':
      return (
        <>
          {base}
          <Field label="Layout">
            <select
              {...register(`blocks.${index}.layout`)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-white/10 px-3 text-sm text-white"
            >
              <option value="classic">classic</option>
              <option value="visit">visit</option>
              <option value="booking">booking</option>
            </select>
          </Field>
          <Field label="Badge">
            <Input {...register(`blocks.${index}.badge`)} className={fieldClass} />
          </Field>
          <Field label="Headline">
            <Input {...register(`blocks.${index}.headline`)} className={fieldClass} />
          </Field>
          <Field label="Subheadline">
            <TextArea register={register} name={`blocks.${index}.subheadline`} />
          </Field>
          <Field label="Image URL">
            <Input {...register(`blocks.${index}.imageUrl`)} className={fieldClass} />
          </Field>
          <Field label="Placeholder búsqueda">
            <Input {...register(`blocks.${index}.searchPlaceholder`)} className={fieldClass} />
          </Field>
          <Field label="Hint búsqueda">
            <Input {...register(`blocks.${index}.searchHint`)} className={fieldClass} />
          </Field>
          <Field label="Label submit búsqueda">
            <Input {...register(`blocks.${index}.searchSubmitLabel`)} className={fieldClass} />
          </Field>
          <CtaFields register={register} prefix={`blocks.${index}.primaryCta`} label="CTA primario" />
          <CtaFields register={register} prefix={`blocks.${index}.secondaryCta`} label="CTA secundario" />
        </>
      )
    case 'items':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Subtítulo">
            <Input {...register(`blocks.${index}.subtitle`)} className={fieldClass} />
          </Field>
          <Field label="Layout">
            <select
              {...register(`blocks.${index}.layout`)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-white/10 px-3 text-sm text-white"
            >
              <option value="grid">grid</option>
              <option value="list">list</option>
            </select>
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.items`}
            label="Ítems"
            renderItem={(i) => (
              <>
                <Field label="Nombre">
                  <Input {...register(`blocks.${index}.items.${i}.name`)} className={fieldClass} />
                </Field>
                <Field label="Detalle">
                  <Input {...register(`blocks.${index}.items.${i}.detail`)} className={fieldClass} />
                </Field>
                <Field label="Categoría">
                  <Input {...register(`blocks.${index}.items.${i}.category`)} className={fieldClass} />
                </Field>
                <Field label="Precio">
                  <Input {...register(`blocks.${index}.items.${i}.priceLabel`)} className={fieldClass} />
                </Field>
                <Field label="Image URL">
                  <Input {...register(`blocks.${index}.items.${i}.imageUrl`)} className={fieldClass} />
                </Field>
              </>
            )}
          />
        </>
      )
    case 'gallery':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.images`}
            label="Imágenes"
            renderItem={(i) => (
              <>
                <Field label="URL">
                  <Input {...register(`blocks.${index}.images.${i}.url`)} className={fieldClass} />
                </Field>
                <Field label="Alt">
                  <Input {...register(`blocks.${index}.images.${i}.alt`)} className={fieldClass} />
                </Field>
              </>
            )}
          />
        </>
      )
    case 'text':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Cuerpo">
            <TextArea register={register} name={`blocks.${index}.body`} rows={5} />
          </Field>
        </>
      )
    case 'hours':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Nota">
            <Input {...register(`blocks.${index}.note`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.rows`}
            label="Filas"
            renderItem={(i) => (
              <>
                <Field label="Etiqueta">
                  <Input {...register(`blocks.${index}.rows.${i}.label`)} className={fieldClass} />
                </Field>
                <Field label="Valor">
                  <Input {...register(`blocks.${index}.rows.${i}.value`)} className={fieldClass} />
                </Field>
              </>
            )}
          />
        </>
      )
    case 'testimonials':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.items`}
            label="Testimonios"
            renderItem={(i) => (
              <>
                <Field label="Autor">
                  <Input {...register(`blocks.${index}.items.${i}.author`)} className={fieldClass} />
                </Field>
                <Field label="Rol">
                  <Input {...register(`blocks.${index}.items.${i}.role`)} className={fieldClass} />
                </Field>
                <Field label="Cita">
                  <TextArea register={register} name={`blocks.${index}.items.${i}.quote`} />
                </Field>
              </>
            )}
          />
        </>
      )
    case 'faq':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.items`}
            label="Preguntas"
            renderItem={(i) => (
              <>
                <Field label="Pregunta">
                  <Input {...register(`blocks.${index}.items.${i}.question`)} className={fieldClass} />
                </Field>
                <Field label="Respuesta">
                  <TextArea register={register} name={`blocks.${index}.items.${i}.answer`} />
                </Field>
              </>
            )}
          />
        </>
      )
    case 'leadForm':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Subtítulo">
            <Input {...register(`blocks.${index}.subtitle`)} className={fieldClass} />
          </Field>
          <Field label="Label enviar">
            <Input {...register(`blocks.${index}.submitLabel`)} className={fieldClass} />
          </Field>
          <Field label="Texto consentimiento">
            <TextArea register={register} name={`blocks.${index}.consentText`} />
          </Field>
          <Field label="Éxito · título">
            <Input {...register(`blocks.${index}.successTitle`)} className={fieldClass} />
          </Field>
          <Field label="Éxito · cuerpo">
            <TextArea register={register} name={`blocks.${index}.successBody`} />
          </Field>
          <CheckboxField
            register={register}
            name={`blocks.${index}.fields.phone`}
            label="Pedir teléfono"
          />
          <CheckboxField
            register={register}
            name={`blocks.${index}.fields.message`}
            label="Pedir mensaje"
          />
        </>
      )
    case 'contact':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Nota">
            <Input {...register(`blocks.${index}.note`)} className={fieldClass} />
          </Field>
          <CheckboxField register={register} name={`blocks.${index}.showWhatsapp`} label="WhatsApp" />
          <CheckboxField register={register} name={`blocks.${index}.showPhone`} label="Teléfono" />
          <CheckboxField register={register} name={`blocks.${index}.showEmail`} label="Email" />
          <CheckboxField register={register} name={`blocks.${index}.showAddress`} label="Dirección" />
          <CheckboxField register={register} name={`blocks.${index}.showMap`} label="Mapa" />
        </>
      )
    case 'cta':
      return (
        <>
          {base}
          <Field label="Headline">
            <Input {...register(`blocks.${index}.headline`)} className={fieldClass} />
          </Field>
          <Field label="Subheadline">
            <Input {...register(`blocks.${index}.subheadline`)} className={fieldClass} />
          </Field>
          <CtaFields register={register} prefix={`blocks.${index}.primaryCta`} label="CTA" />
        </>
      )
    case 'visit':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Cuerpo">
            <TextArea register={register} name={`blocks.${index}.body`} rows={5} />
          </Field>
          <Field label="Geo label">
            <Input {...register(`blocks.${index}.geoLabel`)} className={fieldClass} />
          </Field>
          <Field label="CTA mapas">
            <Input {...register(`blocks.${index}.mapsCtaLabel`)} className={fieldClass} />
          </Field>
          <Field label="CTA horarios">
            <Input {...register(`blocks.${index}.hoursCtaLabel`)} className={fieldClass} />
          </Field>
          <Field label="Placeholder mapa">
            <Input {...register(`blocks.${index}.mapPlaceholder`)} className={fieldClass} />
          </Field>
        </>
      )
    case 'benefits':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.items`}
            label="Beneficios"
            renderItem={(i) => (
              <>
                <Field label="Marca">
                  <Input {...register(`blocks.${index}.items.${i}.mark`)} className={fieldClass} />
                </Field>
                <Field label="Título">
                  <Input {...register(`blocks.${index}.items.${i}.title`)} className={fieldClass} />
                </Field>
                <Field label="Cuerpo">
                  <TextArea register={register} name={`blocks.${index}.items.${i}.body`} />
                </Field>
              </>
            )}
          />
        </>
      )
    case 'team':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Subtítulo">
            <Input {...register(`blocks.${index}.subtitle`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.items`}
            label="Equipo"
            renderItem={(i) => (
              <>
                <Field label="Nombre">
                  <Input {...register(`blocks.${index}.items.${i}.name`)} className={fieldClass} />
                </Field>
                <Field label="Rol">
                  <Input {...register(`blocks.${index}.items.${i}.role`)} className={fieldClass} />
                </Field>
                <Field label="Bio">
                  <TextArea register={register} name={`blocks.${index}.items.${i}.bio`} />
                </Field>
                <Field label="Image URL">
                  <Input {...register(`blocks.${index}.items.${i}.imageUrl`)} className={fieldClass} />
                </Field>
              </>
            )}
          />
        </>
      )
    case 'areas':
      return (
        <>
          {base}
          <Field label="Título">
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label="Subtítulo">
            <Input {...register(`blocks.${index}.subtitle`)} className={fieldClass} />
          </Field>
          <Field label="Mensaje vacío">
            <Input {...register(`blocks.${index}.emptyMessage`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            register={register}
            name={`blocks.${index}.items`}
            label="Áreas / productos"
            renderItem={(i) => (
              <>
                <Field label="Id">
                  <Input {...register(`blocks.${index}.items.${i}.id`)} className={fieldClass} />
                </Field>
                <Field label="Título">
                  <Input {...register(`blocks.${index}.items.${i}.title`)} className={fieldClass} />
                </Field>
                <Field label="Pasillo / aisle">
                  <Input {...register(`blocks.${index}.items.${i}.aisle`)} className={fieldClass} />
                </Field>
                <Field label="Descripción">
                  <TextArea register={register} name={`blocks.${index}.items.${i}.description`} />
                </Field>
                <Field label="CTA">
                  <Input {...register(`blocks.${index}.items.${i}.ctaLabel`)} className={fieldClass} />
                </Field>
                <Field label="Hint">
                  <Input {...register(`blocks.${index}.items.${i}.hintLabel`)} className={fieldClass} />
                </Field>
                <Field label="Image URL">
                  <Input {...register(`blocks.${index}.items.${i}.imageUrl`)} className={fieldClass} />
                </Field>
                <Field label="Image alt">
                  <Input {...register(`blocks.${index}.items.${i}.imageAlt`)} className={fieldClass} />
                </Field>
                <Field label="Needles (coma)">
                  <Input
                    {...register(`blocks.${index}.items.${i}.needles`, {
                      setValueAs: (v: unknown) => {
                        if (Array.isArray(v)) return v
                        if (typeof v !== 'string') return []
                        return v
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      },
                    })}
                    className={fieldClass}
                    placeholder="perfume, dama, 100ml"
                  />
                </Field>
              </>
            )}
          />
        </>
      )
    default:
      return (
        <>
          {base}
          <p className="text-xs text-amber-300">Tipo de bloque sin campos dedicados en el MVP.</p>
        </>
      )
  }
}

export function GlobalFields({
  register,
  errors,
}: {
  register: UseFormRegister<EditorFormValues>
  control: Control<EditorFormValues>
  errors?: FieldErrors<EditorFormValues>
}) {
  const businessError = subtreeHasErrors(errors, 'business')
  const metaError = subtreeHasErrors(errors, 'meta')
  const themeError = subtreeHasErrors(errors, 'theme')

  return (
    <div className="space-y-4">
      <AccordionSection
        title="Datos del negocio"
        defaultOpen
        forceOpen={businessError}
        hasError={businessError}
      >
        <ErrorList errors={errors} path="business" />
        <Field label="Nombre del negocio" error={fieldErrorMessage(errors, 'business.name')}>
          <Input {...register('business.name')} className={fieldClass} />
        </Field>
        <Field label="Frase corta" error={fieldErrorMessage(errors, 'business.tagline')}>
          <Input {...register('business.tagline')} className={fieldClass} />
        </Field>
        <Field label="Ciudad" error={fieldErrorMessage(errors, 'business.city')}>
          <Input {...register('business.city')} className={fieldClass} />
        </Field>
        <Field label="Dirección" error={fieldErrorMessage(errors, 'business.address')}>
          <Input {...register('business.address')} className={fieldClass} />
        </Field>
        <Field label="Búsqueda de Maps" error={fieldErrorMessage(errors, 'business.mapsQuery')}>
          <Input {...register('business.mapsQuery')} className={fieldClass} />
        </Field>
        <Field label="WhatsApp" error={fieldErrorMessage(errors, 'business.whatsapp')}>
          <Input {...register('business.whatsapp')} className={fieldClass} placeholder="+504…" />
        </Field>
        <Field label="Teléfono" error={fieldErrorMessage(errors, 'business.phone')}>
          <Input {...register('business.phone')} className={fieldClass} />
        </Field>
        <Field label="Email del negocio" error={fieldErrorMessage(errors, 'business.email')}>
          <Input {...register('business.email')} className={fieldClass} />
        </Field>
        <Field label="Instagram" error={fieldErrorMessage(errors, 'business.socials.instagram')}>
          <Input {...register('business.socials.instagram')} className={fieldClass} />
        </Field>
        <Field label="Facebook" error={fieldErrorMessage(errors, 'business.socials.facebook')}>
          <Input {...register('business.socials.facebook')} className={fieldClass} />
        </Field>
        <Field label="TikTok" error={fieldErrorMessage(errors, 'business.socials.tiktok')}>
          <Input {...register('business.socials.tiktok')} className={fieldClass} />
        </Field>
      </AccordionSection>

      <AccordionSection title="SEO" forceOpen={metaError} hasError={metaError}>
        <ErrorList errors={errors} path="meta" />
        <Field label="Título SEO" error={fieldErrorMessage(errors, 'meta.seoTitle')}>
          <Input {...register('meta.seoTitle')} className={fieldClass} />
        </Field>
        <Field label="Descripción SEO" error={fieldErrorMessage(errors, 'meta.seoDescription')}>
          <TextArea register={register} name="meta.seoDescription" />
        </Field>
        <Field label="Keywords" error={fieldErrorMessage(errors, 'meta.keywords')}>
          <Input {...register('meta.keywords')} className={fieldClass} />
        </Field>
        <Field label="OG image URL" error={fieldErrorMessage(errors, 'meta.ogImageUrl')}>
          <Input {...register('meta.ogImageUrl')} className={fieldClass} />
        </Field>
        <CheckboxField register={register} name="meta.noindex" label="noindex" />
      </AccordionSection>

      <AccordionSection title="Tema" forceOpen={themeError} hasError={themeError}>
        <ErrorList errors={errors} path="theme" />
        <Field label="Tono" error={fieldErrorMessage(errors, 'theme.tone')}>
          <select
            {...register('theme.tone')}
            className="flex h-10 w-full rounded-md border border-white/10 bg-white/10 px-3 text-sm text-white"
          >
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </Field>
        <Field label="Primary" error={fieldErrorMessage(errors, 'theme.primary')}>
          <Input {...register('theme.primary')} className={fieldClass} />
        </Field>
        <Field label="Accent" error={fieldErrorMessage(errors, 'theme.accent')}>
          <Input {...register('theme.accent')} className={fieldClass} />
        </Field>
        <Field label="Surface" error={fieldErrorMessage(errors, 'theme.surface')}>
          <Input {...register('theme.surface')} className={fieldClass} />
        </Field>
        <Field label="Fuente" error={fieldErrorMessage(errors, 'theme.font')}>
          <select
            {...register('theme.font')}
            className="flex h-10 w-full rounded-md border border-white/10 bg-white/10 px-3 text-sm text-white"
          >
            <option value="sans">sans</option>
            <option value="serif">serif</option>
          </select>
        </Field>
        <Field label="Radio" error={fieldErrorMessage(errors, 'theme.radius')}>
          <select
            {...register('theme.radius')}
            className="flex h-10 w-full rounded-md border border-white/10 bg-white/10 px-3 text-sm text-white"
          >
            <option value="sm">sm</option>
            <option value="md">md</option>
            <option value="lg">lg</option>
          </select>
        </Field>
      </AccordionSection>
    </div>
  )
}

export function BlockAccordion({
  blocks,
  control,
  register,
  errors,
}: {
  blocks: EditableBlockRef[]
  control: Control<EditorFormValues>
  register: UseFormRegister<EditorFormValues>
  errors?: FieldErrors<EditorFormValues>
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bloques</p>
      {blocks.map((block, index) => {
        const path = `blocks.${index}`
        const hasError = subtreeHasErrors(errors, path)
        return (
          <AccordionSection
            key={block.id}
            title={`${index + 1}. ${block.kind} · ${block.id}`}
            forceOpen={hasError}
            hasError={hasError}
          >
            <ErrorList errors={errors} path={path} />
            <BlockFields index={index} kind={block.kind} register={register} control={control} />
          </AccordionSection>
        )
      })}
    </div>
  )
}
