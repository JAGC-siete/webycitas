import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extForMediaMime,
  isSiteMediaKind,
  parseMediaUploadBody,
  publicSiteMediaUrl,
  siteMediaObjectPath,
} from '../lib/suite/media'

describe('suite media upload helpers', () => {
  it('acepta kinds y mime válidos', () => {
    assert.equal(isSiteMediaKind('hero'), true)
    assert.equal(isSiteMediaKind('product'), true)
    assert.equal(isSiteMediaKind('logo'), false)
    assert.equal(extForMediaMime('image/png'), 'png')
    assert.equal(extForMediaMime('image/webp'), 'webp')
    assert.equal(extForMediaMime('image/jpeg'), 'jpg')
  })

  it('arma path y URL pública', () => {
    const path = siteMediaObjectPath('11111111-1111-4111-8111-111111111111', 'hero', 'jpg', 'abc')
    assert.equal(path, 'sites/11111111-1111-4111-8111-111111111111/hero/abc.jpg')
    assert.equal(
      publicSiteMediaUrl('https://example.supabase.co', path),
      'https://example.supabase.co/storage/v1/object/public/site-media/sites/11111111-1111-4111-8111-111111111111/hero/abc.jpg'
    )
  })

  it('parsea body base64 y rechaza mime inválido', () => {
    const ok = parseMediaUploadBody({
      kind: 'item',
      contentType: 'image/png',
      dataBase64: Buffer.from('hi').toString('base64'),
      siteId: '11111111-1111-4111-8111-111111111111',
    })
    assert.equal(ok.ok, true)
    if (ok.ok) {
      assert.equal(ok.kind, 'item')
      assert.equal(ok.siteIdHint, '11111111-1111-4111-8111-111111111111')
      assert.equal(ok.buffer.toString(), 'hi')
    }

    const bad = parseMediaUploadBody({
      kind: 'item',
      contentType: 'application/pdf',
      dataBase64: 'YQ==',
    })
    assert.equal(bad.ok, false)
  })
})
