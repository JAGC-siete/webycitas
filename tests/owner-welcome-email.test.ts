import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDemoLocalOwnerEmail, type DemoLocalLead } from '../lib/magnet/demo-local'

const baseLead: DemoLocalLead = {
  ownerName: 'Allan Castro',
  businessName: 'Personalizados y más',
  email: 'cliente@example.com',
  phone: '22321413',
  rubro: 'ferreteria',
  city: 'SIGUA',
  services: ['landing', 'booking'],
  website: '',
  note: undefined,
}

describe('correo de bienvenida al dueño', () => {
  it('con accessUrl prioriza CTA de contraseña (no login antes de crear clave)', () => {
    const mail = buildDemoLocalOwnerEmail(baseLead, {
      publicUrl: 'https://webycitas.humanosisu.net/p/demo',
      accessUrl: 'https://webycitas.humanosisu.net/auth/update-password?token_hash=abc&type=invite',
      panelUrl: 'https://webycitas.humanosisu.net/app/login',
    })
    assert.match(mail.subject, /Webycitas/)
    assert.match(mail.html, /Ver mi landing/)
    assert.match(mail.html, /Crear contraseña y entrar al panel/)
    assert.match(mail.html, /p\/demo/)
    assert.match(mail.html, /token_hash=abc/)
    assert.doesNotMatch(mail.html, /Ir al panel de reservas/)
    assert.doesNotMatch(mail.html, /Iniciar sesión/)
  })

  it('sin accessUrl y con booking ofrece panel de reservas', () => {
    const mail = buildDemoLocalOwnerEmail(baseLead, {
      publicUrl: 'https://webycitas.humanosisu.net/p/demo',
      panelUrl: 'https://webycitas.humanosisu.net/app/login',
    })
    assert.match(mail.html, /Ir al panel de reservas/)
    assert.doesNotMatch(mail.html, /Crear contraseña y entrar al panel/)
  })

  it('sin booking no promete panel de reservas', () => {
    const mail = buildDemoLocalOwnerEmail(
      { ...baseLead, services: ['landing'] },
      {
        publicUrl: 'https://webycitas.humanosisu.net/p/demo',
        accessUrl: 'https://example.com/access',
        panelUrl: 'http://localhost:3000/app/login',
      }
    )
    assert.doesNotMatch(mail.html, /panel de reservas/)
    assert.match(mail.html, /Ver mi landing/)
    assert.match(mail.html, /Crear contraseña/)
  })
})
