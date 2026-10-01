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
  it('incluye landing, panel de reservas y enlace de acceso', () => {
    const mail = buildDemoLocalOwnerEmail(baseLead, {
      publicUrl: 'https://webycitas.humanosisu.net/p/demo',
      accessUrl: 'https://xxx.supabase.co/auth/v1/verify?token=abc',
      panelUrl: 'http://localhost:3000/app/login',
    })
    assert.match(mail.subject, /Webycitas/)
    assert.match(mail.html, /Ver mi landing/)
    assert.match(mail.html, /panel de reservas/)
    assert.match(mail.html, /Crear contraseña y entrar al panel/)
    assert.match(mail.html, /p\/demo/)
    assert.match(mail.html, /token=abc/)
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
