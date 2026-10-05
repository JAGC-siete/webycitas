import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_LOCAL_COPY,
  WEBYCITAS_MODULE_PRICES,
  WEBYCITAS_PRICING_PACKS,
  parseDemoLocalLead,
} from '../lib/magnet/demo-local'
import { parseLandingLead } from '../lib/landings/lead-schema'
import { INQUIRIES_API_PATH, LEADS_API_PATH, MAGNET_PATH } from '../lib/landings/paths'

describe('contratos públicos', () => {
  it('magnet vive en / y APIs sin company_id', () => {
    assert.equal(MAGNET_PATH, '/')
    assert.equal(LEADS_API_PATH, '/api/leads')
    assert.equal(INQUIRIES_API_PATH, '/api/inquiries')
  })

  it('parsea un lead del magnet', () => {
    const parsed = parseDemoLocalLead({
      ownerName: 'Ana Pérez',
      businessName: 'Barbería El Corte',
      email: 'ana@example.com',
      phone: '3222-6773',
      rubro: 'barberia',
      city: 'Tegucigalpa',
      services: ['landing', 'booking'],
      consent: true,
    })
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.equal(parsed.data.email, 'ana@example.com')
      assert.deepEqual(parsed.data.services, ['landing', 'booking'])
    }
  })

  it('retail fuerza landing y quita booking; conserva inventory/accounting', () => {
    const parsed = parseDemoLocalLead({
      ownerName: 'Chepe',
      businessName: 'Mercadito Don Chepe',
      email: 'chepe@example.com',
      phone: '32226773',
      rubro: 'mercadito',
      city: 'Comayagüela',
      services: ['landing', 'booking', 'inventory', 'accounting'],
      consent: true,
    })
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.deepEqual(parsed.data.services, ['landing', 'inventory', 'accounting'])
    }
  })

  it('acepta inventory y accounting en rubro de servicio', () => {
    const parsed = parseDemoLocalLead({
      ownerName: 'Ana Pérez',
      businessName: 'Barbería El Corte',
      email: 'ana@example.com',
      phone: '3222-6773',
      rubro: 'barberia',
      city: 'Tegucigalpa',
      services: ['landing', 'booking', 'accounting'],
      consent: true,
    })
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.deepEqual(parsed.data.services, ['landing', 'booking', 'accounting'])
    }
  })

  it('inquiry de site pide slug o landingId y contacto', () => {
    const parsed = parseLandingLead({
      slug: 'barberia-el-corte-4f8a',
      fullName: 'Luis',
      phone: '9999-1111',
      consent: true,
    })
    assert.equal(parsed.success, true)
  })

  it('publica precios en Lempiras para packs y módulos', () => {
    assert.match(WEBYCITAS_MODULE_PRICES.landing, /L\.\s*990/)
    assert.match(WEBYCITAS_PRICING_PACKS[1].priceLabel, /L\.\s*1,490/)
    assert.equal(DEMO_LOCAL_COPY.pricing.title.includes('Lempiras'), true)
    assert.match(DEMO_LOCAL_COPY.seo.description, /L\.\s*990/)
  })

  it('hero lidera web+Maps y la marca es Webycitas', () => {
    assert.match(DEMO_LOCAL_COPY.hero.headline, /página web y Google Maps/i)
    assert.match(DEMO_LOCAL_COPY.seo.title, /Webycitas/)
    assert.match(DEMO_LOCAL_COPY.form.consent, /Webycitas/)
    assert.equal(DEMO_LOCAL_COPY.offer.steps[0].title, 'Página web')
    assert.equal(DEMO_LOCAL_COPY.offer.steps[1].title, 'Perfil de Empresa en Google Maps')
    assert.equal(DEMO_LOCAL_COPY.offer.steps[2].title, 'Reservas online')
  })
})
