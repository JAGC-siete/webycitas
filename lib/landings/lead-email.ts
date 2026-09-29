import { emailParagraph, emailRows, wrapEmail } from '../emails'
import { formatDateTimeForHonduras } from '../timezone'
import { landingPublicUrl } from './paths'
import type { LandingLead } from './lead-schema'

export function buildLandingLeadNotification(params: {
  lead: LandingLead
  landingTitle: string
  slug: string
  receivedAt: Date
}): { subject: string; html: string; replyTo?: string } {
  const pageUrl = landingPublicUrl(params.slug)
  const html = wrapEmail(
    'Nuevo lead de tu página',
    [
      emailParagraph(
        `Alguien llenó el formulario de <strong>${params.landingTitle}</strong> (${pageUrl}).`
      ),
      emailRows([
        { label: 'Nombre', value: params.lead.fullName },
        { label: 'Correo', value: params.lead.email || '—' },
        { label: 'Teléfono / WhatsApp', value: params.lead.phone || '—' },
        { label: 'Mensaje', value: params.lead.message || '—' },
        { label: 'Recibido (HN)', value: formatDateTimeForHonduras(params.receivedAt) },
      ]),
    ].join('')
  )

  return {
    subject: `Nuevo lead de tu página — ${params.lead.fullName}`,
    html,
    replyTo: params.lead.email,
  }
}
