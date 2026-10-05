/**
 * Contratos y helpers del booking público (sin sesión owner).
 */

import { z } from 'zod'
import { SITES_TABLE } from '../landings/db'

export const PUBLIC_SERVICES_API = '/api/public/services'
export const PUBLIC_AVAILABILITY_API = '/api/public/availability'
export const PUBLIC_BOOK_API = '/api/public/book'

export interface PublishedBookingSite {
  id: string
  title: string
  slug: string
  lead_notify_email: string | null
}

type AdminClient = ReturnType<typeof import('../supabase/admin').createAdminClient>

export async function resolvePublishedSiteBySlug(
  supabase: AdminClient,
  slug: string
): Promise<PublishedBookingSite | null> {
  const { data, error } = await supabase
    .from(SITES_TABLE)
    .select('id, title, slug, lead_notify_email')
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PublishedBookingSite | null) ?? null
}

const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Día no válido.')

export const publicAvailabilityQuerySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Página no válida.'),
  day: daySchema,
  service_id: z.string().uuid('Servicio no válido.'),
})

export const publicBookSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(63)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Página no válida.'),
    service_id: z.string().uuid('Servicio no válido.'),
    staff_id: z.string().uuid('Profesional no válido.'),
    starts_at: z.string().datetime({ offset: true }),
    customer_name: z
      .string()
      .trim()
      .min(2, 'Escribe tu nombre.')
      .max(120, 'El nombre es demasiado largo.'),
    customer_email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
        message: 'Correo no válido.',
      })
      .optional(),
    customer_phone: z
      .string()
      .trim()
      .max(30)
      .refine((value) => !value || (value.match(/\d/g) || []).length >= 7, {
        message: 'Incluye un teléfono o WhatsApp real.',
      })
      .optional(),
    notes: z.string().trim().max(1000).optional(),
    consent: z.boolean().refine((value) => value === true, {
      message: 'Marca el consentimiento para enviar.',
    }),
    website: z.string().max(200).optional(),
  })
  .refine((body) => Boolean(body.customer_email || body.customer_phone), {
    message: 'Deja al menos un correo o un teléfono.',
    path: ['customer_email'],
  })

export type PublicBookInput = z.output<typeof publicBookSchema>

export function parsePublicBook(body: unknown) {
  return publicBookSchema.safeParse(body)
}

export function publicBookFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'submit')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

export function looksLikePublicBookBot(body: { website?: string }): boolean {
  return Boolean(body.website && body.website.trim().length > 0)
}
