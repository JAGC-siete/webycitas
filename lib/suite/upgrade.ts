/**
 * Upsell de módulos sin billing self-serve.
 * El plan vive en leads.services; activar reservas = ops actualiza el lead.
 * El CTA del owner abre WhatsApp (o mailto) hacia soporte.
 */

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Número público de soporte para upgrade. Vacío = no hay CTA WhatsApp. */
export function suiteSupportWhatsAppDigits(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SUITE_SUPPORT_WHATSAPP || '').trim()
  if (!raw) return null
  const digits = digitsOnly(raw)
  if (digits.length === 8) return `504${digits}`
  if (digits.length >= 11) return digits
  return null
}

export function suiteUpgradeBookingHref(input: {
  businessName: string
  email: string
}): string | null {
  const phone = suiteSupportWhatsAppDigits()
  const text = [
    'Hola, quiero activar el módulo de reservas en Webycitas.',
    `Negocio: ${input.businessName}`,
    `Correo: ${input.email}`,
  ].join('\n')

  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  }

  const subject = encodeURIComponent(`Activar reservas · ${input.businessName}`)
  const body = encodeURIComponent(text)
  return `mailto:?subject=${subject}&body=${body}`
}
