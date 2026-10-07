import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldOfferBookingUpgrade,
  suiteSupportWhatsAppDigits,
  suiteUpgradeBookingHref,
} from '../lib/suite/upgrade'

const PREV = process.env.NEXT_PUBLIC_SUITE_SUPPORT_WHATSAPP

afterEach(() => {
  if (PREV === undefined) delete process.env.NEXT_PUBLIC_SUITE_SUPPORT_WHATSAPP
  else process.env.NEXT_PUBLIC_SUITE_SUPPORT_WHATSAPP = PREV
})

describe('suite upgrade CTA', () => {
  it('normaliza WhatsApp HN a 504', () => {
    process.env.NEXT_PUBLIC_SUITE_SUPPORT_WHATSAPP = '9999-8877'
    assert.equal(suiteSupportWhatsAppDigits(), '50499998877')
  })

  it('arma wa.me con negocio y correo', () => {
    process.env.NEXT_PUBLIC_SUITE_SUPPORT_WHATSAPP = '50432226773'
    const href = suiteUpgradeBookingHref({
      businessName: 'Barbería El Corte',
      email: 'owner@example.com',
    })
    assert.ok(href)
    assert.match(href!, /^https:\/\/wa\.me\/50432226773\?text=/)
    assert.match(decodeURIComponent(href!), /Barbería El Corte/)
    assert.match(decodeURIComponent(href!), /owner@example.com/)
  })

  it('cae a mailto si no hay WhatsApp de soporte', () => {
    delete process.env.NEXT_PUBLIC_SUITE_SUPPORT_WHATSAPP
    const href = suiteUpgradeBookingHref({
      businessName: 'Spa Luna',
      email: 'spa@example.com',
    })
    assert.ok(href?.startsWith('mailto:'))
    assert.match(href!, /Activar%20reservas/)
  })
})

describe('oferta de reservas', () => {
  it('no se ofrece a rubros de venta', () => {
    assert.equal(shouldOfferBookingUpgrade({ modules: ['sitio', 'inventario'], rubro: 'perfumeria' }), false)
    assert.equal(shouldOfferBookingUpgrade({ modules: ['sitio'], rubro: 'ferreteria' }), false)
  })

  it('se ofrece a servicios sin reservas', () => {
    assert.equal(shouldOfferBookingUpgrade({ modules: ['sitio'], rubro: 'barberia' }), true)
  })

  it('no se ofrece si ya la tiene', () => {
    assert.equal(shouldOfferBookingUpgrade({ modules: ['sitio', 'reservas'], rubro: 'spa' }), false)
  })
})
