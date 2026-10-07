/**
 * Campos globales + accordion de bloques para el editor.
 * Anti-scroll (solo un panel abierto) + reorder de bloques con grip HTML5.
 * Modo `owner` (dueño): nombres en español llano, sin campos técnicos y con
 * selector de inventario. Modo `ops`: editor completo.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import {
  useController,
  useFieldArray,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
  type UseFormReturn,
} from 'react-hook-form'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  NEW_ARRAY_ITEM,
  OPS_CTA_ACTIONS,
  OWNER_CTA_ACTIONS,
  blockDisplayName,
  friendlyErrorPath,
  friendlyFieldError,
  itemFromInventoryProduct,
  unlinkedInventory,
  type EditorMode,
} from '../../../lib/landings/editor-labels'
import { formatInventoryPrice, type InventoryProductView } from '../../../lib/landings/inventory'
import { MAX_ITEMS_PER_BLOCK } from '../../../lib/landings/page-schema'
import { SUITE_INVENTARIO_PATH } from '../../../lib/suite/paths'
import { cn } from '../../../lib/utils'
import type { SiteMediaKind } from '../../../lib/suite/media'
import { Card, CardContent, CardHeader } from '../../ui/card'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import ImageUploadField from '../../suite/ImageUploadField'
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

function collectErrors(
  node: unknown,
  prefix = '',
  out: { path: string; message: string }[] = []
): { path: string; message: string }[] {
  if (!node || typeof node !== 'object') return out
  if ('message' in node && typeof (node as { message?: unknown }).message === 'string') {
    const message = (node as { message: string }).message
    if (message) out.push({ path: prefix, message })
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'message' || key === 'type' || key === 'ref') continue
    const next = prefix ? `${prefix}.${key}` : key
    collectErrors(value, next, out)
  }
  return out
}

function ErrorList({ errors, path }: { errors?: FieldErrors; path: string }) {
  const { mode } = useEditorMode()
  if (!subtreeHasErrors(errors, path)) return null
  const parts = path.split('.')
  let cur: unknown = errors
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[part]
  }
  const messages = collectErrors(cur)
    .slice(0, 6)
    .map(({ path: at, message }) => {
      if (mode === 'ops') return at ? `${at}: ${message}` : message
      const where = friendlyErrorPath(at)
      const what = friendlyFieldError(message)
      return where ? `${where}: ${what}` : what
    })
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

interface EditorModeValue {
  mode: EditorMode
  /** Inventario del dueño; null si no tiene el módulo o es ops. */
  inventory: InventoryProductView[] | null
}

const EditorModeContext = createContext<EditorModeValue>({ mode: 'ops', inventory: null })

export function EditorModeProvider({
  mode,
  inventory,
  children,
}: EditorModeValue & { children: ReactNode }) {
  return <EditorModeContext.Provider value={{ mode, inventory }}>{children}</EditorModeContext.Provider>
}

function useEditorMode(): EditorModeValue {
  return useContext(EditorModeContext)
}

/** Errores del formulario para marcar campos y filas sin pasarlos por props. */
const EditorErrorsContext = createContext<FieldErrors<EditorFormValues> | undefined>(undefined)

/** Etiqueta según quién edita: `t('Título principal', 'Headline')`. */
function useLabel(): (owner: string, ops: string) => string {
  const { mode } = useEditorMode()
  return (owner, ops) => (mode === 'owner' ? owner : ops)
}

const selectClass = 'flex h-10 w-full rounded-md border border-white/10 bg-white/10 px-3 text-sm text-white'

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-gray-300">{children}</span>
}

function Field({
  label,
  children,
  error,
  hint,
  path,
}: {
  label: string
  children: ReactNode
  error?: string
  hint?: string
  /** Ruta del campo: muestra su error sin pasarlo a mano. */
  path?: string
}) {
  const { mode } = useEditorMode()
  const errors = useContext(EditorErrorsContext)
  const found = error ?? (path ? fieldErrorMessage(errors, path) : undefined)
  error = found && mode === 'owner' ? friendlyFieldError(found) : found
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-gray-500">{hint}</span>
      ) : null}
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

function FormImageField({
  control,
  name,
  siteId,
  kind,
  label = 'Imagen',
}: {
  control: Control<EditorFormValues>
  name: FieldPath<EditorFormValues>
  siteId: string
  kind: SiteMediaKind
  label?: string
}) {
  const { field } = useController({ control, name })
  return (
    <ImageUploadField
      value={typeof field.value === 'string' ? field.value : ''}
      onChange={field.onChange}
      siteId={siteId}
      kind={kind}
      label={label}
      inputClassName={fieldClass}
    />
  )
}

function AccordionSection({
  title,
  open,
  onToggle,
  hasError = false,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  hasError?: boolean
  children: ReactNode
}) {
  return (
    <Card variant="glass" className={hasError ? 'ring-1 ring-red-400/50' : undefined}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white"
        onClick={onToggle}
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
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-white/50" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
        )}
      </button>
      {open ? <CardContent className="space-y-3 border-t border-white/10 p-4 pt-3">{children}</CardContent> : null}
    </Card>
  )
}

function blockPreviewLabel(block: LandingBlock | undefined): string {
  if (!block) return ''
  if ('headline' in block && typeof block.headline === 'string' && block.headline.trim()) {
    return block.headline.trim()
  }
  if ('title' in block && typeof block.title === 'string' && block.title.trim()) {
    return block.title.trim()
  }
  return block.id
}

function CtaFields({
  register,
  control,
  prefix,
  label,
}: {
  register: UseFormRegister<EditorFormValues>
  control: Control<EditorFormValues>
  prefix: `blocks.${number}.primaryCta` | `blocks.${number}.secondaryCta`
  label: string
}) {
  const { mode } = useEditorMode()
  const action = useWatch({ control, name: `${prefix}.action` })
  const owner = mode === 'owner'
  const actions = owner ? OWNER_CTA_ACTIONS : OPS_CTA_ACTIONS

  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <p className="text-xs font-semibold text-gray-200">{label}</p>
      <Field label={owner ? 'Texto del botón' : 'Etiqueta'}>
        <Input {...register(`${prefix}.label`)} className={fieldClass} />
      </Field>
      <Field label={owner ? 'Qué hace al tocarlo' : 'Acción'}>
        <select {...register(`${prefix}.action`)} className={selectClass}>
          {actions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      {!owner || action === 'link' ? (
        <Field label={owner ? 'Enlace' : 'Href (si link)'}>
          <Input
            {...register(`${prefix}.href`)}
            className={fieldClass}
            placeholder={owner ? 'https://…' : undefined}
          />
        </Field>
      ) : null}
      {!owner || action === 'whatsapp' ? (
        <Field
          label={owner ? 'Mensaje que te llega por WhatsApp' : 'Mensaje WhatsApp'}
          hint={owner ? 'Opcional. Así sabes desde qué botón te escriben.' : undefined}
        >
          <Input {...register(`${prefix}.message`)} className={fieldClass} />
        </Field>
      ) : null}
    </div>
  )
}

interface ArrayToolbar {
  append: (value: Record<string, unknown>) => void
  count: number
  max: number
}

function ArrayEditor<TName extends FieldArrayPath<EditorFormValues>>({
  control,
  name,
  label,
  itemNoun = 'elemento',
  max,
  newItem,
  summary,
  toolbar,
  renderItem,
}: {
  control: Control<EditorFormValues>
  register?: UseFormRegister<EditorFormValues>
  name: TName
  label: string
  itemNoun?: string
  /** Tope del esquema. Con `newItem`, habilita agregar hasta ese número. */
  max?: number
  /** Sin `newItem` la lista es fija: no se agrega ni se quita. */
  newItem?: () => Record<string, unknown>
  /** Resumen de la fila cerrada. Con resumen, el dueño ve la lista plegada. */
  summary?: (index: number) => ReactNode
  toolbar?: (helpers: ArrayToolbar) => ReactNode
  renderItem: (index: number) => ReactNode
}) {
  const { mode } = useEditorMode()
  const errors = useContext(EditorErrorsContext)
  const { fields, append, remove, move } = useFieldArray({ control, name })
  const initialIds = useRef<Set<string> | null>(null)
  if (initialIds.current === null) initialIds.current = new Set(fields.map((field) => field.id))
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const editable = Boolean(newItem)
  const limit = max ?? Number.POSITIVE_INFINITY
  const isOpen = (id: string) => {
    if (open[id] !== undefined) return open[id]
    if (!summary || mode === 'ops') return true
    // Lo recién agregado entra abierto; lo que ya estaba, plegado.
    return !initialIds.current?.has(id)
  }
  const appendItem = (value: Record<string, unknown>) => append(value as never)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-200">
        {label} ({fields.length})
      </p>
      {toolbar ? toolbar({ append: appendItem, count: fields.length, max: limit }) : null}
      {fields.map((field, index) => {
        const rowError = subtreeHasErrors(errors, `${name}.${index}`)
        // Una fila con error siempre queda abierta para ver qué falta.
        const expanded = rowError || isOpen(field.id)
        return (
          <div
            key={field.id}
            className={cn('rounded-lg border', rowError ? 'border-red-400/50' : 'border-white/10')}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setOpen((prev) => ({ ...prev, [field.id]: !expanded }))}
                aria-expanded={expanded}
              >
                <span className="hidden text-[11px] uppercase tracking-wide text-gray-500 sm:inline">
                  #{index + 1}
                </span>
                <span className="min-w-0 flex-1">{summary ? summary(index) : null}</span>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-white/40" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
                )}
              </button>
              {editable ? (
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/50 hover:text-white"
                    aria-label={`Subir ${itemNoun}`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/50 hover:text-white"
                    aria-label={`Bajar ${itemNoun}`}
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-300/70 hover:text-red-300"
                    aria-label={`Quitar ${itemNoun}`}
                    title={fields.length <= 1 ? `Tiene que quedar al menos un ${itemNoun}` : undefined}
                    disabled={fields.length <= 1}
                    onClick={() => {
                      if (mode === 'owner' && !window.confirm(`¿Quitar este ${itemNoun}?`)) return
                      remove(index)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
            {expanded ? (
              <div className="space-y-2 border-t border-white/10 p-3">{renderItem(index)}</div>
            ) : null}
          </div>
        )
      })}
      {editable && newItem ? (
        fields.length < limit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => appendItem(newItem())}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar {itemNoun}
          </Button>
        ) : (
          <p className="text-xs text-gray-500">Llegaste al máximo de {limit}.</p>
        )
      ) : null}
    </div>
  )
}

/** Resumen de una fila: el valor de un campo, o un texto de relleno. */
function TextSummary({
  control,
  name,
  fallback,
}: {
  control: Control<EditorFormValues>
  name: FieldPath<EditorFormValues>
  fallback: string
}) {
  const value = useWatch({ control, name })
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback
  return <span className="block truncate text-sm text-white/80">{text}</span>
}

type ProductItemValues = {
  name?: string
  priceLabel?: string
  imageUrl?: string
  inventoryProductId?: string
}

function ProductSummary({
  control,
  blockIndex,
  itemIndex,
}: {
  control: Control<EditorFormValues>
  blockIndex: number
  itemIndex: number
}) {
  const { inventory } = useEditorMode()
  const item = useWatch({ control, name: `blocks.${blockIndex}.items.${itemIndex}` }) as
    | ProductItemValues
    | undefined
  const linked = item?.inventoryProductId
    ? inventory?.find((product) => product.id === item.inventoryProductId)
    : undefined
  const price = linked ? formatInventoryPrice(linked.precio) : item?.priceLabel

  return (
    <span className="flex min-w-0 items-center gap-2">
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded border border-dashed border-white/15" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white/90">
          {item?.name?.trim() || 'Producto sin nombre'}
        </span>
        <span className="block truncate text-xs text-white/45">
          {price || 'Sin precio'}
          {linked ? (
            <span className={linked.stockActual === 0 ? 'text-red-300' : 'text-emerald-300'}>
              {' · '}
              {linked.stockActual === 0 ? 'Agotado' : `${linked.stockActual} en stock`}
            </span>
          ) : null}
        </span>
      </span>
    </span>
  )
}

/** Precio + vínculo de inventario de un producto. Elige la variante según el modo. */
function ProductPriceFields({
  control,
  register,
  blockIndex,
  itemIndex,
}: {
  control: Control<EditorFormValues>
  register: UseFormRegister<EditorFormValues>
  blockIndex: number
  itemIndex: number
}) {
  const { mode, inventory } = useEditorMode()
  const base = `blocks.${blockIndex}.items.${itemIndex}` as const

  if (mode === 'owner' && inventory) {
    return <OwnerInventoryPriceFields control={control} base={base} inventory={inventory} />
  }

  return (
    <>
      <Field
        label="Precio"
        hint={mode === 'owner' ? 'Escríbelo como quieras que se vea: «L. 1,450», «Desde L. 900»…' : undefined}
      >
        <Input {...register(`${base}.priceLabel`)} className={fieldClass} />
      </Field>
      {mode === 'ops' ? (
        <Field label="ID inventario (opcional)">
          <Input
            {...register(`${base}.inventoryProductId`)}
            className={fieldClass}
            placeholder="uuid del producto"
          />
        </Field>
      ) : null}
    </>
  )
}

function OwnerInventoryPriceFields({
  control,
  base,
  inventory,
}: {
  control: Control<EditorFormValues>
  base: `blocks.${number}.items.${number}`
  inventory: InventoryProductView[]
}) {
  const link = useController({ control, name: `${base}.inventoryProductId` })
  const price = useController({ control, name: `${base}.priceLabel` })
  const linkedId = typeof link.field.value === 'string' ? link.field.value : ''
  const product = inventory.find((item) => item.id === linkedId)
  const priceValue = typeof price.field.value === 'string' ? price.field.value : ''

  return (
    <>
      <Field
        label="Vincular con inventario"
        hint="Si lo vinculas, tu página muestra el precio del inventario y avisa «Agotado» cuando no quede stock."
      >
        <select
          className={selectClass}
          value={linkedId}
          onChange={(event) => {
            const id = event.target.value
            link.field.onChange(id)
            const next = inventory.find((item) => item.id === id)
            if (next) price.field.onChange(formatInventoryPrice(next.precio))
          }}
        >
          <option value="">Sin vincular</option>
          {linkedId && !product ? <option value={linkedId}>Ya no existe en tu inventario</option> : null}
          {inventory.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre} · {item.sku} · {item.stockActual} en stock
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Precio"
        hint={
          product
            ? `Viene del inventario: ${formatInventoryPrice(product.precio)} · ${product.stockActual} en stock. Se cambia en Inventario.`
            : 'Escríbelo como quieras que se vea: «L. 1,450», «Desde L. 900»…'
        }
      >
        <Input
          value={product ? formatInventoryPrice(product.precio) : priceValue}
          onChange={(event) => price.field.onChange(event.target.value)}
          onBlur={price.field.onBlur}
          disabled={Boolean(product)}
          className={fieldClass}
        />
      </Field>
    </>
  )
}

/** Selector "Agregar desde inventario" del bloque de productos (solo dueño). */
function AddFromInventory({
  control,
  blockIndex,
  helpers,
}: {
  control: Control<EditorFormValues>
  blockIndex: number
  helpers: ArrayToolbar
}) {
  const { mode, inventory } = useEditorMode()
  const items = useWatch({ control, name: `blocks.${blockIndex}.items` }) as ProductItemValues[] | undefined
  if (mode !== 'owner' || !inventory) return null

  if (inventory.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-white/15 p-2 text-xs text-gray-400">
        Tu inventario está vacío. Agrega productos en{' '}
        <a href={SUITE_INVENTARIO_PATH} className="text-sky-200 underline">
          Inventario
        </a>{' '}
        para traerlos aquí con precio y stock.
      </p>
    )
  }

  const options = unlinkedInventory(inventory, items)
  const full = helpers.count >= helpers.max

  return (
    <select
      className={selectClass}
      value=""
      disabled={full || options.length === 0}
      aria-label="Agregar desde inventario"
      onChange={(event) => {
        const product = inventory.find((item) => item.id === event.target.value)
        if (product) helpers.append({ ...itemFromInventoryProduct(product) })
      }}
    >
      <option value="">
        {full
          ? 'Llegaste al máximo de productos en esta sección'
          : options.length === 0
            ? 'Todo tu inventario ya está en esta sección'
            : '+ Agregar desde inventario…'}
      </option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.nombre} · {formatInventoryPrice(item.precio)} · {item.stockActual} en stock
        </option>
      ))}
    </select>
  )
}

function BlockFields({
  index,
  kind,
  register,
  control,
  siteId,
}: {
  index: number
  kind: LandingBlock['kind']
  register: UseFormRegister<EditorFormValues>
  control: Control<EditorFormValues>
  siteId: string
}) {
  const { mode } = useEditorMode()
  const owner = mode === 'owner'
  const t = useLabel()
  const base = owner ? (
    <CheckboxField register={register} name={`blocks.${index}.visible`} label="Mostrar en la página" />
  ) : (
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
          {owner ? null : (
            <Field label="Layout">
              <select {...register(`blocks.${index}.layout`)} className={selectClass}>
                <option value="classic">classic</option>
                <option value="visit">visit</option>
                <option value="booking">booking</option>
                <option value="boutique">boutique</option>
              </select>
            </Field>
          )}
          <Field label={t('Etiqueta pequeña (va arriba del título)', 'Badge')}>
            <Input {...register(`blocks.${index}.badge`)} className={fieldClass} />
          </Field>
          <Field label={t('Título principal', 'Headline')}>
            <Input {...register(`blocks.${index}.headline`)} className={fieldClass} />
          </Field>
          <Field label={t('Texto debajo del título', 'Subheadline')}>
            <TextArea register={register} name={`blocks.${index}.subheadline`} />
          </Field>
          <Field label={t('Imagen de portada', 'Imagen')}>
            <FormImageField
              control={control}
              name={`blocks.${index}.imageUrl`}
              siteId={siteId}
              kind="hero"
              label="hero"
            />
          </Field>
          {owner ? null : (
            <>
              <Field label="Placeholder búsqueda">
                <Input {...register(`blocks.${index}.searchPlaceholder`)} className={fieldClass} />
              </Field>
              <Field label="Hint búsqueda">
                <Input {...register(`blocks.${index}.searchHint`)} className={fieldClass} />
              </Field>
              <Field label="Label submit búsqueda">
                <Input {...register(`blocks.${index}.searchSubmitLabel`)} className={fieldClass} />
              </Field>
            </>
          )}
          <CtaFields
            register={register}
            control={control}
            prefix={`blocks.${index}.primaryCta`}
            label={t('Botón principal', 'CTA primario')}
          />
          <CtaFields
            register={register}
            control={control}
            prefix={`blocks.${index}.secondaryCta`}
            label={t('Botón secundario (opcional)', 'CTA secundario')}
          />
        </>
      )
    case 'items':
      return (
        <>
          {base}
          <Field label={t('Título de la sección', 'Título')}>
            <Input {...register(`blocks.${index}.title`)} className={fieldClass} />
          </Field>
          <Field label={t('Subtítulo (opcional)', 'Subtítulo')}>
            <Input {...register(`blocks.${index}.subtitle`)} className={fieldClass} />
          </Field>
          {owner ? null : (
            <Field label="Layout">
              <select {...register(`blocks.${index}.layout`)} className={selectClass}>
                <option value="grid">grid</option>
                <option value="list">list</option>
                <option value="carousel">carousel</option>
              </select>
            </Field>
          )}
          <ArrayEditor
            control={control}
            name={`blocks.${index}.items`}
            label={t('Productos', 'Ítems')}
            itemNoun={t('producto', 'ítem')}
            max={MAX_ITEMS_PER_BLOCK}
            newItem={NEW_ARRAY_ITEM.items}
            summary={(i) => <ProductSummary control={control} blockIndex={index} itemIndex={i} />}
            toolbar={(helpers) => <AddFromInventory control={control} blockIndex={index} helpers={helpers} />}
            renderItem={(i) => (
              <>
                <Field label="Nombre" path={`blocks.${index}.items.${i}.name`}>
                  <Input {...register(`blocks.${index}.items.${i}.name`)} className={fieldClass} />
                </Field>
                <Field
                  label={t('Descripción', 'Detalle')}
                  hint={owner ? 'Opcional. Ej. «Notas de ámbar y vainilla · 100 ml».' : undefined}
                >
                  <Input {...register(`blocks.${index}.items.${i}.detail`)} className={fieldClass} />
                </Field>
                <Field
                  label="Categoría"
                  hint={owner ? 'Agrupa y filtra en tu página. Ej. «Para ella», «Noche».' : undefined}
                >
                  <Input {...register(`blocks.${index}.items.${i}.category`)} className={fieldClass} />
                </Field>
                <ProductPriceFields control={control} register={register} blockIndex={index} itemIndex={i} />
                <Field label={t('Foto', 'Imagen')}>
                  <FormImageField
                    control={control}
                    name={`blocks.${index}.items.${i}.imageUrl`}
                    siteId={siteId}
                    kind="item"
                    label={t('foto', 'ítem')}
                  />
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
            name={`blocks.${index}.images`}
            label={t('Fotos', 'Imágenes')}
            itemNoun="foto"
            max={12}
            newItem={NEW_ARRAY_ITEM.images}
            summary={(i) => (
              <TextSummary control={control} name={`blocks.${index}.images.${i}.alt`} fallback="Foto" />
            )}
            renderItem={(i) => (
              <>
                <Field label="Imagen">
                  <FormImageField
                    control={control}
                    name={`blocks.${index}.images.${i}.url`}
                    siteId={siteId}
                    kind="gallery"
                    label="galería"
                  />
                </Field>
                <Field
                  label={t('Descripción de la foto', 'Alt')}
                  hint={owner ? 'Ayuda a Google y a personas con lector de pantalla.' : undefined}
                >
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
          <Field label={t('Nota (opcional)', 'Nota')}>
            <Input {...register(`blocks.${index}.note`)} className={fieldClass} />
          </Field>
          <ArrayEditor
            control={control}
            name={`blocks.${index}.rows`}
            label={t('Días y horas', 'Filas')}
            itemNoun={t('fila', 'fila')}
            max={8}
            newItem={NEW_ARRAY_ITEM.rows}
            summary={(i) => (
              <TextSummary control={control} name={`blocks.${index}.rows.${i}.label`} fallback="Día" />
            )}
            renderItem={(i) => (
              <>
                <Field
                  label={t('Día(s)', 'Etiqueta')}
                  hint={owner ? 'Ej. «Lunes a viernes».' : undefined}
                  path={`blocks.${index}.rows.${i}.label`}
                >
                  <Input {...register(`blocks.${index}.rows.${i}.label`)} className={fieldClass} />
                </Field>
                <Field
                  label={t('Horario', 'Valor')}
                  hint={owner ? 'Ej. «9:00 a. m. – 6:00 p. m.».' : undefined}
                  path={`blocks.${index}.rows.${i}.value`}
                >
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
            name={`blocks.${index}.items`}
            label={t('Opiniones', 'Testimonios')}
            itemNoun={t('opinión', 'testimonio')}
            max={9}
            newItem={NEW_ARRAY_ITEM.testimonials}
            summary={(i) => (
              <TextSummary control={control} name={`blocks.${index}.items.${i}.author`} fallback="Sin nombre" />
            )}
            renderItem={(i) => (
              <>
                <Field label={t('Nombre', 'Autor')} path={`blocks.${index}.items.${i}.author`}>
                  <Input {...register(`blocks.${index}.items.${i}.author`)} className={fieldClass} />
                </Field>
                <Field label={t('Detalle (opcional)', 'Rol')} hint={owner ? 'Ej. «Clienta desde 2023».' : undefined}>
                  <Input {...register(`blocks.${index}.items.${i}.role`)} className={fieldClass} />
                </Field>
                <Field label={t('Opinión', 'Cita')} path={`blocks.${index}.items.${i}.quote`}>
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
            name={`blocks.${index}.items`}
            label="Preguntas"
            itemNoun="pregunta"
            max={12}
            newItem={NEW_ARRAY_ITEM.faq}
            summary={(i) => (
              <TextSummary
                control={control}
                name={`blocks.${index}.items.${i}.question`}
                fallback="Pregunta sin escribir"
              />
            )}
            renderItem={(i) => (
              <>
                <Field label="Pregunta" path={`blocks.${index}.items.${i}.question`}>
                  <Input {...register(`blocks.${index}.items.${i}.question`)} className={fieldClass} />
                </Field>
                <Field label="Respuesta" path={`blocks.${index}.items.${i}.answer`}>
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
          <Field label={t('Texto del botón enviar', 'Label enviar')}>
            <Input {...register(`blocks.${index}.submitLabel`)} className={fieldClass} />
          </Field>
          <Field label={t('Texto de consentimiento', 'Texto consentimiento')}>
            <TextArea register={register} name={`blocks.${index}.consentText`} />
          </Field>
          <Field label={t('Mensaje al enviar · título', 'Éxito · título')}>
            <Input {...register(`blocks.${index}.successTitle`)} className={fieldClass} />
          </Field>
          <Field label={t('Mensaje al enviar · texto', 'Éxito · cuerpo')}>
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
          <CheckboxField register={register} name={`blocks.${index}.showEmail`} label={t('Correo', 'Email')} />
          <CheckboxField register={register} name={`blocks.${index}.showAddress`} label="Dirección" />
          <CheckboxField register={register} name={`blocks.${index}.showMap`} label="Mapa" />
        </>
      )
    case 'cta':
      return (
        <>
          {base}
          <Field label={t('Título', 'Headline')}>
            <Input {...register(`blocks.${index}.headline`)} className={fieldClass} />
          </Field>
          <Field label={t('Texto', 'Subheadline')}>
            <Input {...register(`blocks.${index}.subheadline`)} className={fieldClass} />
          </Field>
          <Field label={t('Imagen del banner', 'Imagen (banner destacado)')}>
            <FormImageField
              control={control}
              name={`blocks.${index}.imageUrl`}
              siteId={siteId}
              kind="hero"
              label="banner"
            />
          </Field>
          <CtaFields
            register={register}
            control={control}
            prefix={`blocks.${index}.primaryCta`}
            label={t('Botón', 'CTA')}
          />
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
          <Field label={t('Zona o referencia', 'Geo label')}>
            <Input {...register(`blocks.${index}.geoLabel`)} className={fieldClass} />
          </Field>
          <Field label={t('Texto del botón de mapa', 'CTA mapas')}>
            <Input {...register(`blocks.${index}.mapsCtaLabel`)} className={fieldClass} />
          </Field>
          <Field label={t('Texto del botón de horario', 'CTA horarios')}>
            <Input {...register(`blocks.${index}.hoursCtaLabel`)} className={fieldClass} />
          </Field>
          <Field label={t('Texto mientras carga el mapa', 'Placeholder mapa')}>
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
            name={`blocks.${index}.items`}
            label={t('Razones', 'Beneficios')}
            itemNoun={t('razón', 'beneficio')}
            max={MAX_ITEMS_PER_BLOCK}
            newItem={NEW_ARRAY_ITEM.benefits}
            summary={(i) => (
              <TextSummary control={control} name={`blocks.${index}.items.${i}.title`} fallback="Sin título" />
            )}
            renderItem={(i) => (
              <>
                <Field label={t('Ícono o símbolo corto', 'Marca')} hint={owner ? 'Hasta 8 caracteres. Ej. «✦» o «100%».' : undefined}>
                  <Input {...register(`blocks.${index}.items.${i}.mark`)} className={fieldClass} />
                </Field>
                <Field label="Título">
                  <Input {...register(`blocks.${index}.items.${i}.title`)} className={fieldClass} />
                </Field>
                <Field label={t('Texto', 'Cuerpo')}>
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
            name={`blocks.${index}.items`}
            label="Equipo"
            itemNoun="persona"
            max={MAX_ITEMS_PER_BLOCK}
            newItem={NEW_ARRAY_ITEM.team}
            summary={(i) => (
              <TextSummary control={control} name={`blocks.${index}.items.${i}.name`} fallback="Sin nombre" />
            )}
            renderItem={(i) => (
              <>
                <Field label="Nombre">
                  <Input {...register(`blocks.${index}.items.${i}.name`)} className={fieldClass} />
                </Field>
                <Field label="Rol">
                  <Input {...register(`blocks.${index}.items.${i}.role`)} className={fieldClass} />
                </Field>
                <Field label={t('Descripción', 'Bio')}>
                  <TextArea register={register} name={`blocks.${index}.items.${i}.bio`} />
                </Field>
                <Field label="Imagen">
                  <FormImageField
                    control={control}
                    name={`blocks.${index}.items.${i}.imageUrl`}
                    siteId={siteId}
                    kind="team"
                    label="equipo"
                  />
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
            name={`blocks.${index}.items`}
            label={t('Secciones', 'Áreas / productos')}
            renderItem={(i) => (
              <>
                {owner ? null : (
                  <Field label="Id">
                    <Input {...register(`blocks.${index}.items.${i}.id`)} className={fieldClass} />
                  </Field>
                )}
                <Field label="Título">
                  <Input {...register(`blocks.${index}.items.${i}.title`)} className={fieldClass} />
                </Field>
                <Field label={t('Pasillo', 'Pasillo / aisle')}>
                  <Input {...register(`blocks.${index}.items.${i}.aisle`)} className={fieldClass} />
                </Field>
                <Field label="Descripción">
                  <TextArea register={register} name={`blocks.${index}.items.${i}.description`} />
                </Field>
                <Field label={t('Texto del botón', 'CTA')}>
                  <Input {...register(`blocks.${index}.items.${i}.ctaLabel`)} className={fieldClass} />
                </Field>
                <Field label={t('Ayuda', 'Hint')}>
                  <Input {...register(`blocks.${index}.items.${i}.hintLabel`)} className={fieldClass} />
                </Field>
                <Field label="Imagen">
                  <FormImageField
                    control={control}
                    name={`blocks.${index}.items.${i}.imageUrl`}
                    siteId={siteId}
                    kind="item"
                    label="área"
                  />
                </Field>
                <Field label={t('Descripción de la foto', 'Image alt')}>
                  <Input {...register(`blocks.${index}.items.${i}.imageAlt`)} className={fieldClass} />
                </Field>
                <Field label={t('Palabras para el buscador (separadas por coma)', 'Needles (coma)')}>
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
          <p className="text-xs text-amber-300">
            {t('Esta sección no se puede editar desde aquí.', 'Tipo de bloque sin campos dedicados en el MVP.')}
          </p>
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
  const { mode } = useEditorMode()
  const owner = mode === 'owner'
  const t = useLabel()
  type GlobalSection = 'business' | 'seo' | 'theme'
  const businessError = subtreeHasErrors(errors, 'business')
  const metaError = subtreeHasErrors(errors, 'meta')
  const themeError = subtreeHasErrors(errors, 'theme')
  const [openSection, setOpenSection] = useState<GlobalSection | null>('business')

  useEffect(() => {
    if (businessError) setOpenSection('business')
    else if (metaError) setOpenSection('seo')
    else if (themeError) setOpenSection('theme')
  }, [businessError, metaError, themeError])

  const toggleSection = (section: GlobalSection) => {
    setOpenSection((prev) => {
      if (prev === section) return null
      return section
    })
  }

  return (
    <div className="space-y-4">
      <AccordionSection
        title="Datos del negocio"
        open={openSection === 'business'}
        onToggle={() => toggleSection('business')}
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
        <Field
          label={t('Cómo te buscan en Google Maps', 'Búsqueda de Maps')}
          error={fieldErrorMessage(errors, 'business.mapsQuery')}
          hint={owner ? 'Tal como aparece tu negocio en Maps: nombre y ciudad.' : undefined}
        >
          <Input {...register('business.mapsQuery')} className={fieldClass} />
        </Field>
        <Field label="WhatsApp" error={fieldErrorMessage(errors, 'business.whatsapp')}>
          <Input {...register('business.whatsapp')} className={fieldClass} placeholder="+504…" />
        </Field>
        <Field label="Teléfono" error={fieldErrorMessage(errors, 'business.phone')}>
          <Input {...register('business.phone')} className={fieldClass} />
        </Field>
        <Field label={t('Correo del negocio', 'Email del negocio')} error={fieldErrorMessage(errors, 'business.email')}>
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

      <AccordionSection
        title={t('Avanzado (cómo te ve Google)', 'SEO')}
        open={openSection === 'seo'}
        onToggle={() => toggleSection('seo')}
        hasError={metaError}
      >
        <ErrorList errors={errors} path="meta" />
        <Field
          label={t('Título en Google', 'Título SEO')}
          error={fieldErrorMessage(errors, 'meta.seoTitle')}
          hint={owner ? 'El título azul que sale en los resultados de búsqueda.' : undefined}
        >
          <Input {...register('meta.seoTitle')} className={fieldClass} />
        </Field>
        <Field
          label={t('Descripción en Google', 'Descripción SEO')}
          error={fieldErrorMessage(errors, 'meta.seoDescription')}
        >
          <TextArea register={register} name="meta.seoDescription" />
        </Field>
        <Field label={t('Palabras clave', 'Keywords')} error={fieldErrorMessage(errors, 'meta.keywords')}>
          <Input {...register('meta.keywords')} className={fieldClass} />
        </Field>
        <Field
          label={t('Imagen al compartir en redes (enlace)', 'OG image URL')}
          error={fieldErrorMessage(errors, 'meta.ogImageUrl')}
        >
          <Input {...register('meta.ogImageUrl')} className={fieldClass} />
        </Field>
        {owner ? null : <CheckboxField register={register} name="meta.noindex" label="noindex" />}
      </AccordionSection>

      {owner ? null : (
        <AccordionSection
          title="Tema"
          open={openSection === 'theme'}
          onToggle={() => toggleSection('theme')}
          hasError={themeError}
        >
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
      )}
    </div>
  )
}

export function BlockAccordion({
  control,
  register,
  errors,
  siteId,
}: {
  control: Control<EditorFormValues>
  register: UseFormRegister<EditorFormValues>
  errors?: FieldErrors<EditorFormValues>
  siteId: string
}) {
  const { mode } = useEditorMode()
  const owner = mode === 'owner'
  const { fields, move } = useFieldArray({
    control,
    name: 'blocks',
    keyName: '_rhfId',
  })
  const watchedBlocks = useWatch({ control, name: 'blocks' }) as LandingBlock[] | undefined
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const isCollapsed = (fieldId: string, index: number) => {
    if (collapsed[fieldId] !== undefined) return collapsed[fieldId]
    // Por defecto: con >3 bloques, colapsar todas salvo la última (anti scroll fatigue)
    return fields.length > 3 && index < fields.length - 1
  }

  const setBlockCollapsed = (fieldId: string, value: boolean) => {
    setCollapsed((prev) => ({ ...prev, [fieldId]: value }))
  }

  const expandOnly = (fieldId: string) => {
    const next: Record<string, boolean> = {}
    for (const f of fields) next[f._rhfId] = f._rhfId !== fieldId
    setCollapsed(next)
  }

  useEffect(() => {
    if (!errors?.blocks || !Array.isArray(errors.blocks)) return
    for (let i = 0; i < fields.length; i++) {
      if (subtreeHasErrors(errors, `blocks.${i}`)) {
        expandOnly(fields[i]._rhfId)
        break
      }
    }
    // Solo reaccionar a errores; fields se lee fresco en el cuerpo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors?.blocks])

  const onDragStart = (index: number) => (e: DragEvent) => {
    setDragFrom(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const onDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== index) setDragOver(index)
  }

  const onDrop = (toIndex: number) => (e: DragEvent) => {
    e.preventDefault()
    const from =
      dragFrom ?? Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
    setDragFrom(null)
    setDragOver(null)
    if (!Number.isFinite(from) || from === toIndex) return
    move(from, toIndex)
  }

  return (
    <EditorErrorsContext.Provider value={errors}>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {owner ? 'Secciones de tu página' : 'Bloques · arrastrá el grip para reordenar'}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white"
            onClick={() => {
              const next: Record<string, boolean> = {}
              for (const f of fields) next[f._rhfId] = true
              setCollapsed(next)
            }}
          >
            {owner ? 'Cerrar todo' : 'Colapsar'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white"
            onClick={() => {
              const next: Record<string, boolean> = {}
              for (const f of fields) next[f._rhfId] = false
              setCollapsed(next)
            }}
          >
            {owner ? 'Abrir todo' : 'Expandir'}
          </Button>
        </div>
      </div>

      {fields.map((field, index) => {
        const path = `blocks.${index}`
        const hasError = subtreeHasErrors(errors, path)
        const block = watchedBlocks?.[index]
        const kind = block?.kind ?? (field as { kind?: string }).kind ?? 'bloque'
        const kindName = blockDisplayName(kind, mode)
        const preview = blockPreviewLabel(block)
        const collapsedNow = isCollapsed(field._rhfId, index)
        const visible = block?.visible !== false

        return (
          <Card
            key={field._rhfId}
            variant="glass"
            draggable={false}
            onDragOver={onDragOver(index)}
            onDrop={onDrop(index)}
            className={cn(
              'transition-colors',
              hasError && 'ring-1 ring-red-400/50',
              dragOver === index && dragFrom !== index && 'ring-2 ring-brand-400/60'
            )}
          >
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-3 py-2">
              <button
                type="button"
                className="cursor-grab touch-none rounded p-1 text-white/40 hover:bg-white/10 hover:text-white active:cursor-grabbing"
                title="Arrastrar para reordenar"
                aria-label={`Arrastrar ${owner ? 'sección' : 'bloque'} ${kindName}`}
                draggable
                onDragStart={onDragStart(index)}
                onDragEnd={() => {
                  setDragFrom(null)
                  setDragOver(null)
                }}
              >
                <GripVertical className="h-5 w-5" />
              </button>

              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => {
                  if (collapsedNow) expandOnly(field._rhfId)
                  else setBlockCollapsed(field._rhfId, true)
                }}
                aria-expanded={!collapsedNow}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600/25 text-xs font-bold text-brand-200">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="block truncate text-sm font-semibold text-white">{kindName}</span>
                    {hasError ? (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                        Error
                      </span>
                    ) : null}
                    {!visible ? (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                        Oculto
                      </span>
                    ) : null}
                  </span>
                  {collapsedNow ? (
                    <span className="block truncate text-xs text-white/45">
                      {preview && preview !== block?.id ? preview : owner ? '' : preview || 'sin título'}
                    </span>
                  ) : null}
                </span>
                {collapsedNow ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
                ) : (
                  <ChevronUp className="h-4 w-4 shrink-0 text-white/50" />
                )}
              </button>
              {/* Flechas: el grip HTML5 no funciona con el dedo en el celular. */}
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/40 hover:text-white"
                  aria-label={`Subir ${kindName}`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/40 hover:text-white"
                  aria-label={`Bajar ${kindName}`}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>

            {!collapsedNow ? (
              <CardContent className="space-y-3 border-t border-white/10 p-4 pt-3">
                <ErrorList errors={errors} path={path} />
                <BlockFields
                  index={index}
                  kind={(block?.kind ?? kind) as LandingBlock['kind']}
                  register={register}
                  control={control}
                  siteId={siteId}
                />
              </CardContent>
            ) : null}
          </Card>
        )
      })}
    </div>
    </EditorErrorsContext.Provider>
  )
}
