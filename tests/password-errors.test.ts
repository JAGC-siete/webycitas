import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { passwordUpdateErrorMessage } from '../lib/auth/password-errors'

describe('errores al guardar la contraseña', () => {
  it('explica en palabras simples cuando repite la contraseña actual', () => {
    assert.match(passwordUpdateErrorMessage({ code: 'same_password', message: 'New password should be different' }), /contraseña actual/)
  })

  it('nunca muestra el texto en inglés de Supabase', () => {
    const out = passwordUpdateErrorMessage({ code: 'something_new', message: 'Unexpected failure' })
    assert.doesNotMatch(out, /Unexpected|failure/)
  })

  it('un reintento no vuelve a gastar el enlace ya validado', () => {
    const page = readFileSync(join(process.cwd(), 'pages/auth/update-password.tsx'), 'utf8')
    assert.match(page, /if \(tokenHash && !linkVerified\)/)
    assert.match(page, /setLinkVerified\(true\)/)
  })

  it('la pantalla habla de tú, no de vos', () => {
    const page = readFileSync(join(process.cwd(), 'pages/auth/update-password.tsx'), 'utf8')
    assert.doesNotMatch(page, /Pedí|usá|Entrá|restablecé/)
  })
})
