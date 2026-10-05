/**
 * Inventario del owner. El saldo cambia con un movimiento, no editando la celda.
 */

import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { Loader2, Plus } from 'lucide-react'
import {
  InventoryProductDialog,
  InventoryTable,
  type InventoryDraft,
} from '../../../components/landings/inventory/InventoryPanel'
import SuiteShell from '../../../components/suite/SuiteShell'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import type { InventoryProductView } from '../../../lib/landings/inventory'
import {
  createSuiteInventoryProduct,
  deleteSuiteInventoryProduct,
  fetchSuiteInventory,
  moveSuiteInventoryStock,
  updateSuiteInventoryProduct,
} from '../../../lib/suite/inventory-api'
import { SUITE_SITIO_PATH } from '../../../lib/suite/paths'
import { requireSuitePage, tenantProps, type SuiteTenant } from '../../../lib/suite/tenant'

function parseAmount(raw: string): number | null {
  const value = Number(raw.replace(',', '.'))
  if (!Number.isFinite(value)) return null
  return value
}

function parseCount(raw: string): number | null {
  if (raw.trim() === '') return 0
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return null
  return value
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuitePage(ctx, { module: 'inventario' })
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: tenantProps(auth.context.tenant) }
}

export default function SuiteInventarioPage({ tenant }: { tenant: SuiteTenant }) {
  const [products, setProducts] = useState<InventoryProductView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'edit'; product: InventoryProductView | null }>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const inventory = await fetchSuiteInventory()
      setProducts(inventory.products)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onDelta(product: InventoryProductView, delta: 1 | -1) {
    if (pendingId) return
    setPendingId(product.id)
    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              stockActual: item.stockActual + delta,
              low: item.stockActual + delta <= item.stockMinimo,
            }
          : item
      )
    )
    try {
      const result = await moveSuiteInventoryStock(product.id, delta)
      setProducts((current) => current.map((item) => (item.id === result.product.id ? result.product : item)))
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo mover el stock')
      const fresh = await fetchSuiteInventory().catch(() => null)
      if (fresh) setProducts(fresh.products)
    } finally {
      setPendingId(null)
    }
  }

  async function onSubmit(draft: InventoryDraft) {
    const precio = parseAmount(draft.precio)
    const stockMinimo = parseCount(draft.stockMinimo)
    if (precio === null || precio < 0 || stockMinimo === null) {
      setDialogError('Revisa el precio y el mínimo.')
      return
    }

    setSaving(true)
    setDialogError(null)
    try {
      if (dialog?.mode === 'edit' && dialog.product) {
        const result = await updateSuiteInventoryProduct(dialog.product.id, {
          nombre: draft.nombre.trim(),
          sku: draft.sku.trim(),
          precio,
          stockMinimo,
        })
        setProducts((current) => current.map((item) => (item.id === result.product.id ? result.product : item)))
      } else {
        const stockInicial = parseCount(draft.stockInicial)
        if (stockInicial === null) {
          setDialogError('El stock inicial tiene que ser un entero.')
          setSaving(false)
          return
        }
        const result = await createSuiteInventoryProduct({
          nombre: draft.nombre.trim(),
          sku: draft.sku.trim(),
          precio,
          stockMinimo,
          stockInicial,
        })
        if (result.product) {
          setProducts((current) =>
            [...current, result.product as InventoryProductView].sort((a, b) =>
              a.nombre.localeCompare(b.nombre, 'es')
            )
          )
        }
      }
      setDialog(null)
    } catch (err: unknown) {
      setDialogError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!dialog?.product) return
    setSaving(true)
    setDialogError(null)
    try {
      await deleteSuiteInventoryProduct(dialog.product.id)
      setProducts((current) => current.filter((item) => item.id !== dialog.product?.id))
      setDialog(null)
    } catch (err: unknown) {
      setDialogError(err instanceof Error ? err.message : 'No se pudo borrar')
    } finally {
      setSaving(false)
    }
  }

  const hasSitio = tenant.modules.includes('sitio')

  return (
    <SuiteShell tenant={tenant}>
      <Head>
        <title>Inventario · {tenant.businessName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="space-y-6 px-4 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Inventario</h1>
            <p className="text-sm text-white/60">
              Productos, precios y saldo. El stock solo se mueve con + y −.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasSitio ? (
              <Button asChild variant="outline">
                <Link href={SUITE_SITIO_PATH}>Editar sitio</Link>
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setDialogError(null)
                setDialog({ mode: 'create', product: null })
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Producto
            </Button>
          </div>
        </header>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando productos…
              </div>
            ) : (
              <InventoryTable
                products={products}
                pendingId={pendingId}
                onEdit={(product) => {
                  setDialogError(null)
                  setDialog({ mode: 'edit', product })
                }}
                onDelta={(product, delta) => void onDelta(product, delta)}
              />
            )}
          </CardContent>
        </Card>

        {dialog ? (
          <InventoryProductDialog
            key={dialog.product?.id ?? 'new'}
            mode={dialog.mode}
            product={dialog.product}
            saving={saving}
            error={dialogError}
            onClose={() => setDialog(null)}
            onSubmit={(draft) => void onSubmit(draft)}
            onDelete={() => void onDelete()}
          />
        ) : null}
      </div>
    </SuiteShell>
  )
}
