import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { collectInventoryProductIds, formatInventoryPrice, toInventoryProductView } from '../lib/landings/inventory'
import {
  createInventoryProductSchema,
  INVENTORY_MOVEMENT_MAX,
  inventoryMovementSchema,
  movementDelta,
  updateInventoryProductSchema,
} from '../lib/landings/inventory-schema'
import { optionalInventoryProductIdSchema, type LandingPageContent } from '../lib/landings/page-schema'

const PRODUCT = '11111111-1111-4111-8111-111111111111'

describe('inventario de site', () => {
  it('acepta un alta con stock inicial y rechaza precio negativo', () => {
    const ok = createInventoryProductSchema.safeParse({
      nombre: 'Colonia',
      sku: 'COL-1',
      precio: 250,
      stockMinimo: 2,
      stockInicial: 5,
    })
    assert.equal(ok.success, true)

    const bad = createInventoryProductSchema.safeParse({
      nombre: 'Colonia',
      sku: 'COL-1',
      precio: -1,
      stockMinimo: 0,
    })
    assert.equal(bad.success, false)
  })

  it('rechaza SKU con caracteres inválidos', () => {
    const bad = createInventoryProductSchema.safeParse({
      nombre: 'Colonia',
      sku: 'COL 1',
      precio: 10,
      stockMinimo: 0,
    })
    assert.equal(bad.success, false)
  })

  it('la edición no exige saldo y un cuerpo vacío no pasa', () => {
    const ok = updateInventoryProductSchema.safeParse({ precio: 10, stockMinimo: 1 })
    assert.equal(ok.success, true)
    assert.equal('stockActual' in (ok.success ? ok.data : {}), false)

    const empty = updateInventoryProductSchema.safeParse({})
    assert.equal(empty.success, false)
  })

  it('un movimiento es un entero distinto de cero dentro del tope', () => {
    for (const delta of [1, -1, 24, -24, INVENTORY_MOVEMENT_MAX, -INVENTORY_MOVEMENT_MAX]) {
      assert.equal(inventoryMovementSchema.safeParse({ delta }).success, true, String(delta))
    }
    for (const delta of [0, 1.5, INVENTORY_MOVEMENT_MAX + 1, -INVENTORY_MOVEMENT_MAX - 1, '24']) {
      assert.equal(inventoryMovementSchema.safeParse({ delta }).success, false, String(delta))
    }
  })

  it('movementDelta firma la cantidad y no deja sacar más de lo que hay', () => {
    assert.deepEqual(movementDelta('in', '24', 3), { delta: 24, error: null })
    assert.deepEqual(movementDelta('out', ' 5 ', 20), { delta: -5, error: null })
    assert.equal(movementDelta('out', '30', 27).error, 'Solo hay 27 en stock.')
    for (const raw of ['', '0', '-3', '2.5', 'abc', String(INVENTORY_MOVEMENT_MAX + 1)]) {
      assert.equal(movementDelta('in', raw, 0).delta, null, raw)
    }
  })

  it('junta los ids citados en listas de precios', () => {
    const content = {
      blocks: [
        {
          kind: 'items',
          items: [{ inventoryProductId: PRODUCT }, { inventoryProductId: PRODUCT }, {}],
        },
        { kind: 'text', body: 'sin stock' },
      ],
    } as LandingPageContent

    assert.deepEqual(collectInventoryProductIds(content), [PRODUCT])
  })

  it('un enlace vacío no es un id y uno mal formado se rechaza', () => {
    assert.equal(optionalInventoryProductIdSchema.parse(''), undefined)
    assert.equal(optionalInventoryProductIdSchema.parse(PRODUCT), PRODUCT)
    assert.equal(optionalInventoryProductIdSchema.safeParse('no-es-uuid').success, false)
  })

  it('marca bajo mínimo y formatea el precio público', () => {
    const view = toInventoryProductView({
      id: PRODUCT,
      nombre: 'Colonia',
      sku: 'COL-1',
      precio: '250.50',
      stock_actual: 1,
      stock_minimo: 1,
      image_url: 'https://cdn.example.com/col.png',
    })
    assert.equal(view.low, true)
    assert.equal(view.precio, 250.5)
    assert.equal(view.imageUrl, 'https://cdn.example.com/col.png')
    assert.match(formatInventoryPrice(250.5), /^L\. 250[.,]50$/)
  })
})
