/**
 * Tabla, alta/edición, botones +/− y movimientos por cantidad del inventario del site.
 */

import { useState } from 'react'
import { ArrowLeftRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import ImageUploadField from '../../suite/ImageUploadField'
import { formatInventoryPrice, type InventoryProductView } from '../../../lib/landings/inventory'
import { movementDelta, type MoveKind } from '../../../lib/landings/inventory-schema'

export function StockStepper({
  stock,
  pending,
  onDelta,
}: {
  stock: number
  pending: boolean
  onDelta: (delta: 1 | -1) => void
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Sacar una unidad"
        disabled={pending || stock <= 0}
        onClick={() => onDelta(-1)}
      >
        −
      </Button>
      <span className="min-w-8 text-center font-mono text-sm text-white">{stock}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Entrar una unidad"
        disabled={pending}
        onClick={() => onDelta(1)}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : '+'}
      </Button>
    </div>
  )
}

export function InventoryTable({
  products,
  pendingId,
  onEdit,
  onDelta,
  onMove,
}: {
  products: InventoryProductView[]
  pendingId: string | null
  onEdit: (product: InventoryProductView) => void
  onDelta: (product: InventoryProductView, delta: 1 | -1) => void
  onMove: (product: InventoryProductView) => void
}) {
  if (products.length === 0) {
    return <p className="text-sm text-white/55">Todavía no hay productos en tu inventario.</p>
  }

  return (
    <>
      <ul className="space-y-3 sm:hidden">
        {products.map((product) => (
          <li key={product.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start gap-3">
              <ProductThumb imageUrl={product.imageUrl} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{product.nombre}</p>
                <p className="font-mono text-xs text-gray-400">{product.sku}</p>
                <p className="mt-1 text-sm text-gray-200">{formatInventoryPrice(product.precio)}</p>
              </div>
              <EditButton onClick={() => onEdit(product)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <StockControls product={product} pendingId={pendingId} onDelta={onDelta} onMove={onMove} />
              {product.low ? <LowBadge /> : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm text-gray-200">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-400">
              <th className="px-3 py-2 font-medium">Foto</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Precio</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Aviso</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-white/5">
                <td className="px-3 py-3">
                  <ProductThumb imageUrl={product.imageUrl} />
                </td>
                <td className="px-3 py-3 font-mono text-xs">{product.sku}</td>
                <td className="px-3 py-3">{product.nombre}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatInventoryPrice(product.precio)}</td>
                <td className="px-3 py-3">
                  <StockControls product={product} pendingId={pendingId} onDelta={onDelta} onMove={onMove} />
                </td>
                <td className="px-3 py-3">
                  {product.low ? <LowBadge /> : <span className="text-gray-500">—</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  <EditButton onClick={() => onEdit(product)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProductThumb({ imageUrl }: { imageUrl: string | null }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover" />
  ) : (
    <span className="inline-block h-10 w-10 shrink-0 rounded-md border border-dashed border-white/15" />
  )
}

function LowBadge() {
  return (
    <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Bajo mínimo</span>
  )
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Editar producto" onClick={onClick}>
      <Pencil className="h-4 w-4" />
    </Button>
  )
}

function StockControls({
  product,
  pendingId,
  onDelta,
  onMove,
}: {
  product: InventoryProductView
  pendingId: string | null
  onDelta: (product: InventoryProductView, delta: 1 | -1) => void
  onMove: (product: InventoryProductView) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <StockStepper
        stock={product.stockActual}
        pending={pendingId === product.id}
        onDelta={(delta) => onDelta(product, delta)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pendingId === product.id}
        onClick={() => onMove(product)}
      >
        <ArrowLeftRight className="mr-1.5 h-4 w-4" />
        Mover
      </Button>
    </div>
  )
}

export interface InventoryDraft {
  nombre: string
  sku: string
  precio: string
  stockMinimo: string
  stockInicial: string
  imageUrl: string
}

const EMPTY_DRAFT: InventoryDraft = {
  nombre: '',
  sku: '',
  precio: '',
  stockMinimo: '0',
  stockInicial: '',
  imageUrl: '',
}

export function InventoryProductDialog({
  mode,
  product,
  siteId,
  saving,
  error,
  onClose,
  onSubmit,
  onDelete,
}: {
  mode: 'create' | 'edit'
  product: InventoryProductView | null
  siteId: string
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: InventoryDraft) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<InventoryDraft>(() =>
    mode === 'edit' && product
      ? {
          nombre: product.nombre,
          sku: product.sku,
          precio: String(product.precio),
          stockMinimo: String(product.stockMinimo),
          stockInicial: '',
          imageUrl: product.imageUrl ?? '',
        }
      : EMPTY_DRAFT
  )

  function setField(key: keyof InventoryDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        className="glass-modern w-full max-w-md space-y-4 rounded-2xl p-5"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(draft)
        }}
      >
        <h2 className="text-lg font-semibold text-white">
          {mode === 'create' ? 'Nuevo producto' : 'Editar producto'}
        </h2>
        <label className="block text-sm text-white/80">
          Nombre
          <Input
            value={draft.nombre}
            onChange={(event) => setField('nombre', event.target.value)}
            className="input-glass mt-1 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            required
          />
        </label>
        <label className="block text-sm text-white/80">
          SKU
          <Input
            value={draft.sku}
            onChange={(event) => setField('sku', event.target.value)}
            className="input-glass mt-1 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            required
          />
        </label>
        <div className="block text-sm text-white/80">
          <span className="mb-1 block">Foto</span>
          <ImageUploadField
            value={draft.imageUrl}
            onChange={(next) => setField('imageUrl', next)}
            siteId={siteId}
            kind="product"
            label="producto"
            inputClassName="input-glass h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-white/80">
            Precio
            <Input
              value={draft.precio}
              onChange={(event) => setField('precio', event.target.value)}
              inputMode="decimal"
              className="input-glass mt-1 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              required
            />
          </label>
          <label className="block text-sm text-white/80">
            Mínimo
            <Input
              value={draft.stockMinimo}
              onChange={(event) => setField('stockMinimo', event.target.value)}
              inputMode="numeric"
              className="input-glass mt-1 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              required
            />
          </label>
        </div>
        {mode === 'create' ? (
          <label className="block text-sm text-white/80">
            Stock inicial
            <Input
              value={draft.stockInicial}
              onChange={(event) => setField('stockInicial', event.target.value)}
              inputMode="numeric"
              placeholder="0"
              className="input-glass mt-1 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </label>
        ) : (
          <p className="text-xs text-white/45">
            El saldo se mueve desde la tabla: + y − de a uno, o «Mover» para varias unidades.
          </p>
        )}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          {mode === 'edit' ? (
            <Button type="button" variant="ghost" onClick={onDelete} disabled={saving}>
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

export function InventoryMoveDialog({
  product,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  product: InventoryProductView
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (delta: number) => void
}) {
  const [kind, setKind] = useState<MoveKind>('in')
  const [qty, setQty] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const parsed = movementDelta(kind, qty, product.stockActual)
  const after = parsed.delta === null ? null : product.stockActual + parsed.delta

  function kindClass(active: boolean) {
    return active
      ? 'border-brand-400/40 bg-brand-600/25 font-semibold text-white'
      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        className="glass-modern w-full max-w-sm space-y-4 rounded-2xl p-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (parsed.delta === null) {
            setLocalError(parsed.error)
            return
          }
          setLocalError(null)
          onSubmit(parsed.delta)
        }}
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Mover stock</h2>
          <p className="text-sm text-white/60">{product.nombre}</p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de movimiento">
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'in'}
            disabled={saving}
            className={`rounded-xl border px-3 py-2 text-sm ${kindClass(kind === 'in')}`}
            onClick={() => setKind('in')}
          >
            Entrada
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'out'}
            disabled={saving}
            className={`rounded-xl border px-3 py-2 text-sm ${kindClass(kind === 'out')}`}
            onClick={() => setKind('out')}
          >
            Salida
          </button>
        </div>
        <label className="block text-sm text-white/80">
          Cantidad
          <Input
            value={qty}
            onChange={(event) => {
              setQty(event.target.value)
              setLocalError(null)
            }}
            inputMode="numeric"
            placeholder="Ej. 24"
            disabled={saving}
            autoFocus
            className="input-glass mt-1 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </label>
        <p className="text-sm text-white/70">
          Stock actual: <span className="font-mono text-white">{product.stockActual}</span>
          {after !== null ? (
            <>
              {' '}→ quedará: <span className="font-mono text-white">{after}</span>
            </>
          ) : null}
        </p>
        {localError || error ? <p className="text-sm text-red-300">{localError ?? error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {kind === 'in' ? 'Registrar entrada' : 'Registrar salida'}
          </Button>
        </div>
      </form>
    </div>
  )
}
