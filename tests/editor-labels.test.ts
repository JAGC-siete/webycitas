import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  NEW_ARRAY_ITEM,
  OWNER_CTA_ACTIONS,
  blockDisplayName,
  friendlyErrorPath,
  friendlyFieldError,
  itemFromInventoryProduct,
  unlinkedInventory,
} from '../lib/landings/editor-labels'
import { prepareEditorFormValues } from '../lib/landings/editor-form'
import { itemsBlockSchema, readLandingPageContent } from '../lib/landings/page-schema'
import { buildWebycitasPreviewContent } from '../lib/magnet/preview'

const PRODUCT_ID = '7331c197-716a-42df-aec9-5e804174ef25'

describe('editor del dueño', () => {
  it('nombra los bloques en español para el dueño y deja el kind para ops', () => {
    assert.equal(blockDisplayName('hero', 'owner'), 'Portada')
    assert.equal(blockDisplayName('items', 'owner'), 'Productos')
    assert.equal(blockDisplayName('leadForm', 'owner'), 'Formulario de contacto')
    assert.equal(blockDisplayName('desconocido', 'owner'), 'Sección')
    assert.equal(blockDisplayName('hero', 'ops'), 'hero')
  })

  it('las acciones del botón cubren las mismas que acepta el esquema', () => {
    const values = OWNER_CTA_ACTIONS.map((option) => option.value).sort()
    assert.deepEqual(values, ['call', 'lead-form', 'link', 'maps', 'whatsapp'])
  })

  it('un producto del inventario se convierte en ítem vinculado y válido', () => {
    const item = itemFromInventoryProduct({
      id: PRODUCT_ID,
      nombre: 'Oud Real 100 ml',
      precio: 1450,
      imageUrl: '/img/oud.webp',
    })
    assert.equal(item.inventoryProductId, PRODUCT_ID)
    assert.match(item.priceLabel, /^L\. 1[,.]450[.,]00$/)
    assert.equal(item.imageUrl, '/img/oud.webp')

    const block = itemsBlockSchema.safeParse({
      id: 'catalogo',
      kind: 'items',
      title: 'Más vendidos',
      items: [item],
    })
    assert.equal(block.success, true)
  })

  it('no agrega imageUrl vacía cuando el producto no tiene foto', () => {
    const item = itemFromInventoryProduct({ id: PRODUCT_ID, nombre: 'Sin foto', precio: 10, imageUrl: null })
    assert.equal('imageUrl' in item, false)
  })

  it('unlinkedInventory deja fuera lo que ya está en la sección', () => {
    const products = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const left = unlinkedInventory(products, [{ inventoryProductId: 'b' }, { inventoryProductId: '' }, {}])
    assert.deepEqual(left.map((p) => p.id), ['a', 'c'])
  })

  it('un producto agregado vacío no pasa la validación hasta tener nombre', () => {
    const block = itemsBlockSchema.safeParse(
      prepareEditorFormValues({ id: 'catalogo', kind: 'items', title: 'Más vendidos', items: [NEW_ARRAY_ITEM.items()] })
    )
    assert.equal(block.success, false)
  })
})

describe('vista previa del editor', () => {
  it('los inputs vacíos ("") no rompen la vista previa una vez limpiados', () => {
    const raw = structuredClone(
      buildWebycitasPreviewContent({
        rubro: 'perfumeria',
        businessName: 'QA Perfumería',
        city: 'Siguatepeque',
        phone: '+504 0000-0000',
        email: 'qa@example.com',
      })
    ) as unknown as { business: Record<string, unknown> }
    assert.equal(readLandingPageContent(raw).ok, true)
    // Así llegan los inputs vacíos desde react-hook-form.
    raw.business = { ...raw.business, socials: { instagram: '', facebook: '' }, address: '' }
    assert.equal(readLandingPageContent(raw).ok, false)
    const cleaned = readLandingPageContent(prepareEditorFormValues(raw))
    assert.equal(cleaned.ok, true)
  })
})

describe('errores para el dueño', () => {
  it('traduce la ruta del error contando desde 1, como en pantalla', () => {
    assert.equal(friendlyErrorPath('items.6.name'), '#7 · Nombre')
    assert.equal(friendlyErrorPath('primaryCta.href'), 'Botón principal · Enlace')
    assert.equal(friendlyErrorPath('socials.instagram'), 'Instagram')
    assert.equal(friendlyErrorPath(''), '')
  })

  it('traduce los mensajes por defecto de zod y deja pasar los propios', () => {
    assert.equal(friendlyFieldError('Invalid input: expected string, received undefined'), 'Falta completar este campo.')
    assert.equal(friendlyFieldError('Too small: expected string to have >=1 characters'), 'Falta completar este campo.')
    assert.equal(friendlyFieldError('Too small: expected string to have >=2 characters'), 'Escribe al menos 2 caracteres.')
    assert.equal(friendlyFieldError('Too big: expected string to have <=80 characters'), 'Es muy largo: máximo 80 caracteres.')
    assert.equal(friendlyFieldError('Invalid email address'), 'Revisa el correo: no parece válido.')
    const own = 'Usa una URL https, una ruta interna que empiece con / o una ancla #seccion.'
    assert.equal(friendlyFieldError(own), own)
  })
})
