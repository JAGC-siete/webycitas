import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { postLoginPath } from '../lib/auth/role-access'
import {
  editorFormSchema,
  emptyStringsToUndefined,
  prepareEditorFormValues,
  suiteEditorFormSchema,
} from '../lib/landings/editor-form'
import {
  LANDINGS_ADMIN_API_PREFIX,
  LANDINGS_ADMIN_PATH,
  landingAdminApiPath,
  landingAdminEditPath,
  landingAdminPublishApiPath,
} from '../lib/landings/paths'
import {
  hasUnpublishedChanges,
  sameLandingContent,
  withPublishState,
} from '../lib/landings/publish-state'
import { RETAIL_VISIT_TEMPLATE_CONTENT } from '../lib/landings/retail-visit'

describe('landing editor ops', () => {
  it('postLoginPath acepta redirect a /app/landings para super_admin', () => {
    assert.equal(postLoginPath('super_admin', '/app/landings'), '/app/landings')
    assert.equal(
      postLoginPath('super_admin', '/app/landings/a98c8c66-61ce-4536-b343-7fbad54e9ec7/edit'),
      '/app/landings/a98c8c66-61ce-4536-b343-7fbad54e9ec7/edit'
    )
    assert.equal(postLoginPath('super_admin', '/app'), '/admin')
    assert.equal(postLoginPath('owner', '/app/landings'), '/app')
  })

  it('paths del editor apuntan a ops landings', () => {
    assert.equal(LANDINGS_ADMIN_PATH, '/app/landings')
    assert.equal(LANDINGS_ADMIN_API_PREFIX, '/api/admin/ops/landings')
    const id = 'a98c8c66-61ce-4536-b343-7fbad54e9ec7'
    assert.equal(landingAdminEditPath(id), `/app/landings/${id}/edit`)
    assert.equal(landingAdminApiPath(id), `/api/admin/ops/landings/${id}`)
    assert.equal(landingAdminPublishApiPath(id), `/api/admin/ops/landings/${id}/publish`)
  })

  it('emptyStringsToUndefined limpia opcionales vacíos', () => {
    const cleaned = emptyStringsToUndefined({
      business: { name: 'X', whatsapp: '', phone: '' },
      nested: { url: '' },
    }) as {
      business: { name: string; whatsapp?: string; phone?: string }
      nested: { url?: string }
    }
    assert.equal(cleaned.business.name, 'X')
    assert.equal(cleaned.business.whatsapp, undefined)
    assert.equal(cleaned.business.phone, undefined)
    assert.equal(cleaned.nested.url, undefined)
  })

  it('editorFormSchema acepta plantilla retail con whatsapp vacío tras preprocess', () => {
    const base = RETAIL_VISIT_TEMPLATE_CONTENT.papeleria
    const raw = prepareEditorFormValues({
      ...base,
      business: { ...base.business, name: 'Perfumes y mas', whatsapp: '', phone: '' },
      _title: 'Perfumes y mas',
      _slug: 'perfumes-y-mas',
      _notifyEmail: '',
    })
    const parsed = editorFormSchema.safeParse(raw)
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data._title, 'Perfumes y mas')
    assert.equal(parsed.data._slug, 'perfumes-y-mas')
    assert.equal(parsed.data.business.whatsapp, undefined)
  })

  it('editorFormSchema rechaza slug inválido', () => {
    const base = RETAIL_VISIT_TEMPLATE_CONTENT.papeleria
    const parsed = editorFormSchema.safeParse({
      ...base,
      _title: 'Demo',
      _slug: 'AB',
      _notifyEmail: '',
    })
    assert.equal(parsed.success, false)
  })

  it('suiteEditorFormSchema no exige slug editable', () => {
    const base = RETAIL_VISIT_TEMPLATE_CONTENT.papeleria
    const parsed = suiteEditorFormSchema.safeParse({
      ...base,
      _title: 'Mi negocio',
      _notifyEmail: '',
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data._title, 'Mi negocio')
  })
})

describe('publish state', () => {
  const draft = { version: 1, business: { name: 'Ville', tagline: 'v1' }, blocks: [] }

  it('compara contenido sin importar el orden de las llaves', () => {
    const reordered = { blocks: [], business: { tagline: 'v1', name: 'Ville' }, version: 1 }
    assert.equal(sameLandingContent(draft, reordered), true)
    assert.equal(sameLandingContent(draft, { ...draft, business: { name: 'Ville', tagline: 'v2' } }), false)
  })

  it('solo un site publicado tiene cambios pendientes', () => {
    const edited = { ...draft, business: { name: 'Ville', tagline: 'v2' } }
    assert.equal(
      hasUnpublishedChanges({ status: 'published', content_json: edited, published_content_json: draft }),
      true
    )
    assert.equal(
      hasUnpublishedChanges({ status: 'published', content_json: draft, published_content_json: draft }),
      false
    )
    assert.equal(
      hasUnpublishedChanges({ status: 'draft', content_json: edited, published_content_json: draft }),
      false
    )
  })

  it('withPublishState no expone la copia publicada', () => {
    const row = withPublishState({
      id: 's1',
      status: 'published',
      content_json: draft,
      published_content_json: null,
    })
    assert.equal('published_content_json' in row, false)
    assert.equal(row.has_unpublished_changes, true)
  })
})
