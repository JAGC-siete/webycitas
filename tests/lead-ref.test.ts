import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  WEBYCITAS_LEAD_REF_NOTE,
  WEBYCITAS_LEAD_REFS,
  WEBYCITAS_LEAD_SOURCE,
  leadSourceForRef,
  parseDemoLocalLead,
  parseLeadRef,
} from '../lib/magnet/demo-local'

const baseLead = {
  ownerName: 'Ana Pérez',
  businessName: 'Barbería El Corte',
  email: 'ana@example.com',
  phone: '3222-6773',
  rubro: 'barberia',
  city: 'Siguatepeque',
  services: ['landing'],
  consent: true,
}

describe('lead ref (?ref=)', () => {
  it('only the allow-list passes', () => {
    assert.deepEqual([...WEBYCITAS_LEAD_REFS], ['sigua-online'])
    assert.equal(parseLeadRef('sigua-online'), 'sigua-online')
    assert.equal(parseLeadRef('  Sigua-Online '), 'sigua-online')
    assert.equal(parseLeadRef('mercado'), undefined)
    assert.equal(parseLeadRef('sigua-online.com'), undefined)
    assert.equal(parseLeadRef('ana@example.com'), undefined)
    assert.equal(parseLeadRef(''), undefined)
    assert.equal(parseLeadRef(['sigua-online']), undefined)
    assert.equal(parseLeadRef(undefined), undefined)
  })

  it('source falls back to the magnet default', () => {
    assert.equal(leadSourceForRef('sigua-online'), 'sigua-online')
    assert.equal(leadSourceForRef(undefined), WEBYCITAS_LEAD_SOURCE)
  })

  it('source fits the leads_source_len check (3..40)', () => {
    for (const ref of WEBYCITAS_LEAD_REFS) {
      assert.ok(ref.length >= 3 && ref.length <= 40, ref)
    }
  })

  it('a lead keeps a known ref', () => {
    const parsed = parseDemoLocalLead({ ...baseLead, ref: 'sigua-online' })
    assert.equal(parsed.success, true)
    if (parsed.success) assert.equal(parsed.data.ref, 'sigua-online')
  })

  it('an unknown ref is dropped without rejecting the lead', () => {
    for (const ref of ['otro-sitio', 42, { a: 1 }, 'x'.repeat(500)]) {
      const parsed = parseDemoLocalLead({ ...baseLead, ref })
      assert.equal(parsed.success, true)
      if (parsed.success) assert.equal(parsed.data.ref, undefined)
    }
  })

  it('a lead without ref stays a plain magnet lead', () => {
    const parsed = parseDemoLocalLead(baseLead)
    assert.equal(parsed.success, true)
    if (parsed.success) assert.equal(leadSourceForRef(parsed.data.ref), WEBYCITAS_LEAD_SOURCE)
  })

  it('every ref has a plain note for the magnet', () => {
    for (const ref of WEBYCITAS_LEAD_REFS) {
      assert.ok(WEBYCITAS_LEAD_REF_NOTE[ref].length > 0)
    }
    assert.match(WEBYCITAS_LEAD_REF_NOTE['sigua-online'], /Siguatepeque/)
  })
})
