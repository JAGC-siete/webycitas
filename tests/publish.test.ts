import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { allocatePreviewSlug } from '../lib/magnet/publish'
import { LEADS_TABLE } from '../lib/magnet/demo-local'
import { SITES_TABLE, SITE_INQUIRIES_TABLE } from '../lib/landings/db'

describe('publish slugs + ownership tables', () => {
  it('no usa company_id: dueño es leads → sites', () => {
    assert.equal(LEADS_TABLE, 'leads')
    assert.equal(SITES_TABLE, 'sites')
    assert.equal(SITE_INQUIRIES_TABLE, 'site_inquiries')
  })

  it('slugify respeta reserved y nombres cortos', () => {
    assert.equal(allocatePreviewSlug('Admin', 'aa11'), 'admin-aa11')
    assert.equal(allocatePreviewSlug('A', 'zz99'), 'negocio-zz99')
  })
})
