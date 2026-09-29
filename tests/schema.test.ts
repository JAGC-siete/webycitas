import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseDemoLocalLead } from '../lib/magnet/demo-local'
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

  it('retail fuerza landing', () => {
    const parsed = parseDemoLocalLead({
      ownerName: 'Chepe',
      businessName: 'Mercadito Don Chepe',
      email: 'chepe@example.com',
      phone: '32226773',
      rubro: 'mercadito',
      city: 'Comayagüela',
      services: ['landing', 'booking'],
      consent: true,
    })
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.deepEqual(parsed.data.services, ['landing'])
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
})
