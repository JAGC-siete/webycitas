import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isPerfumeriaContent,
  perfumeriaItemsForOccasion,
  perfumeriaOccasions,
  perfumeriaOrderMessage,
} from '../lib/landings/perfumeria'
import { templateContentFor } from '../lib/landings/templates'
import { landingThemeCssVars, onAccentColor } from '../lib/landings/theme-css'
import { normalizeServicesForRubro } from '../lib/magnet/demo-local'
import { buildWebycitasPreviewContent, templateKeyForRubro } from '../lib/magnet/preview'

describe('plantilla perfumería', () => {
  it('valida y se reconoce como vitrina boutique', () => {
    const content = templateContentFor('perfumeria')
    assert.equal(isPerfumeriaContent(content), true)
    assert.equal(content.theme.tone, 'dark')
    assert.equal(isPerfumeriaContent(templateContentFor('ferreteria')), false)
    assert.equal(isPerfumeriaContent(templateContentFor('spa')), false)
  })

  it('trae catálogo por ocasión, carrusel y banners con foto', () => {
    const content = templateContentFor('perfumeria')
    const items = content.blocks.filter((block) => block.kind === 'items')
    assert.ok(items.some((block) => block.kind === 'items' && block.layout === 'carousel'))
    const catalog = items.find((block) => block.id === 'catalogo')
    assert.ok(catalog && catalog.kind === 'items')
    assert.ok(perfumeriaOccasions(catalog.items).length >= 4)
    const spotlights = content.blocks.filter((block) => block.kind === 'cta')
    assert.ok(spotlights.length > 0)
    assert.ok(spotlights.every((block) => block.kind === 'cta' && Boolean(block.imageUrl)))
  })

  it('filtra por ocasión sin perder orden', () => {
    const items = [
      { name: 'A', category: 'Noche' },
      { name: 'B', category: 'Oficina' },
      { name: 'C', category: 'Noche' },
      { name: 'D' },
    ]
    assert.deepEqual(perfumeriaOccasions(items), ['Noche', 'Oficina'])
    assert.deepEqual(perfumeriaItemsForOccasion(items, 'Noche').map((i) => i.name), ['A', 'C'])
    assert.equal(perfumeriaItemsForOccasion(items, null).length, 4)
  })

  it('arma el pedido de WhatsApp con precio o aviso de restock', () => {
    const business = { name: 'Esencia' }
    assert.equal(
      perfumeriaOrderMessage(business, 'Decant 10 ml', 'L. 350'),
      'Hola Esencia, me interesa: Decant 10 ml (L. 350). ¿Está disponible?'
    )
    assert.match(perfumeriaOrderMessage(business, 'Oud', undefined, true), /avísenme/)
  })

  it('el rubro público perfumería publica la vitrina y es retail', () => {
    assert.equal(templateKeyForRubro('perfumeria'), 'perfumeria')
    assert.deepEqual(normalizeServicesForRubro('perfumeria', ['landing', 'booking', 'inventory']), [
      'landing',
      'inventory',
    ])
    const content = buildWebycitasPreviewContent({
      rubro: 'perfumeria',
      businessName: 'Perfumería Esencia',
      city: 'San Pedro Sula',
      phone: '3222-6773',
    })
    assert.equal(isPerfumeriaContent(content), true)
    assert.equal(content.business.name, 'Perfumería Esencia')
    assert.equal(content.meta.noindex, true)
  })
})

describe('texto sobre el color de acento', () => {
  it('usa tinta oscura sobre dorado y blanco sobre azul', () => {
    assert.equal(onAccentColor('#c9a24a'), '#14110c')
    assert.equal(onAccentColor('#2563eb'), '#ffffff')
    assert.equal(onAccentColor('#1f5eff'), '#ffffff')
    assert.equal(onAccentColor('#fff'), '#14110c')
  })

  it('cae en blanco si el color no es un hex válido', () => {
    assert.equal(onAccentColor('blue'), '#ffffff')
  })

  it('expone --lp-on-accent con el acento del tema', () => {
    const vars = landingThemeCssVars(templateContentFor('perfumeria').theme)
    assert.equal(vars['--lp-on-accent'], onAccentColor(vars['--lp-accent']))
  })

  it('la hoja de perfumería no fija colores de tinta sobre el acento', () => {
    const css = readFileSync(join(process.cwd(), 'components/landings/perfumeria.module.css'), 'utf8')
    assert.doesNotMatch(css, /#14110c|#3a2a17/i)
  })
})
