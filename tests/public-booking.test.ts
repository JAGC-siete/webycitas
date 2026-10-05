import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseDurationMinFromDetail,
  parseLempirasToCents,
  catalogItemsForRubro,
  DEFAULT_BOOKING_SCHEDULES,
} from '../lib/suite/booking-seed'
import {
  parsePublicBook,
  publicAvailabilityQuerySchema,
  looksLikePublicBookBot,
} from '../lib/suite/public-booking'
import { addMinutesIso } from '../lib/suite/schemas'

describe('booking seed helpers', () => {
  it('parses lempiras strings to cents', () => {
    assert.equal(parseLempirasToCents('L. 150'), 15000)
    assert.equal(parseLempirasToCents('L. 1,250'), 125000)
    assert.equal(parseLempirasToCents('Desde L. 700'), 70000)
    assert.equal(parseLempirasToCents('Según lista'), 0)
  })

  it('parses duration from detail text', () => {
    assert.equal(parseDurationMinFromDetail('Máquina + tijera, 30 min'), 30)
    assert.equal(parseDurationMinFromDetail('Cita de 20 min'), 20)
    assert.equal(parseDurationMinFromDetail('Sin minutos'), 30)
  })

  it('loads catalog items for known rubros', () => {
    const items = catalogItemsForRubro('barberia')
    assert.ok(items.length >= 3)
    assert.equal(items[0]?.name, 'Corte clásico')
  })

  it('default schedules cover Mon-Sat', () => {
    assert.deepEqual(
      DEFAULT_BOOKING_SCHEDULES.map((s) => s.weekday),
      [1, 2, 3, 4, 5, 6]
    )
  })
})

describe('public book schema', () => {
  const serviceId = '11111111-1111-4111-8111-111111111111'
  const staffId = '22222222-2222-4222-8222-222222222222'

  it('accepts a valid booking payload', () => {
    const ok = parsePublicBook({
      slug: 'barberia-el-corte-ab12',
      service_id: serviceId,
      staff_id: staffId,
      starts_at: '2026-10-06T15:00:00.000Z',
      customer_name: 'Ana López',
      customer_phone: '50499998888',
      consent: true,
    })
    assert.equal(ok.success, true)
  })

  it('rejects missing contact and honeypot detection', () => {
    const bad = parsePublicBook({
      slug: 'barberia-el-corte-ab12',
      service_id: serviceId,
      staff_id: staffId,
      starts_at: '2026-10-06T15:00:00.000Z',
      customer_name: 'Ana',
      consent: true,
    })
    assert.equal(bad.success, false)
    assert.equal(looksLikePublicBookBot({ website: 'http://spam.test' }), true)
    assert.equal(looksLikePublicBookBot({ website: '' }), false)
  })

  it('validates availability query', () => {
    const ok = publicAvailabilityQuerySchema.safeParse({
      slug: 'negocio-abcd',
      day: '2026-10-06',
      service_id: serviceId,
    })
    assert.equal(ok.success, true)
    const bad = publicAvailabilityQuerySchema.safeParse({
      slug: 'x',
      day: '06-10-2026',
      service_id: 'nope',
    })
    assert.equal(bad.success, false)
  })

  it('computes ends_at with duration + buffer', () => {
    assert.equal(addMinutesIso('2026-10-06T15:00:00.000Z', 45), '2026-10-06T15:45:00.000Z')
  })
})
