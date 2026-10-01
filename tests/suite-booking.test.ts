import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addMinutesIso,
  formatLempirasFromCents,
  rangesOverlap,
  appointmentCreateSchema,
  serviceUpsertSchema,
} from '../lib/suite/schemas'

describe('suite booking helpers', () => {
  it('formats lempiras from cents', () => {
    assert.equal(formatLempirasFromCents(15000), 'L. 150')
    assert.match(formatLempirasFromCents(16050), /L\. 160/)
  })

  it('detects range overlap', () => {
    const a0 = new Date('2026-10-01T15:00:00.000Z')
    const a1 = new Date('2026-10-01T16:00:00.000Z')
    const b0 = new Date('2026-10-01T15:30:00.000Z')
    const b1 = new Date('2026-10-01T16:30:00.000Z')
    const c0 = new Date('2026-10-01T16:00:00.000Z')
    const c1 = new Date('2026-10-01T17:00:00.000Z')
    assert.equal(rangesOverlap(a0, a1, b0, b1), true)
    assert.equal(rangesOverlap(a0, a1, c0, c1), false)
  })

  it('adds minutes to ISO timestamps', () => {
    assert.equal(addMinutesIso('2026-10-01T15:00:00.000Z', 30), '2026-10-01T15:30:00.000Z')
  })

  it('validates appointment create payload', () => {
    const ok = appointmentCreateSchema.safeParse({
      customer_name: 'Ana',
      starts_at: '2026-10-01T15:00:00.000Z',
      source: 'manual',
    })
    assert.equal(ok.success, true)
    const bad = appointmentCreateSchema.safeParse({ customer_name: '', starts_at: 'nope' })
    assert.equal(bad.success, false)
  })

  it('validates bookable service upsert', () => {
    const ok = serviceUpsertSchema.safeParse({
      name: 'Corte clásico',
      price_cents: 16000,
      duration_min: 30,
    })
    assert.equal(ok.success, true)
  })
})
