/**
 * Validación compartida del upload de media del site (landing + inventario).
 */

export const SITE_MEDIA_BUCKET = 'site-media'

export const SITE_MEDIA_KINDS = ['hero', 'item', 'gallery', 'team', 'product'] as const
export type SiteMediaKind = (typeof SITE_MEDIA_KINDS)[number]

export const SITE_MEDIA_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const SITE_MEDIA_MAX_BYTES = 5 * 1024 * 1024

export function isSiteMediaKind(value: unknown): value is SiteMediaKind {
  return typeof value === 'string' && (SITE_MEDIA_KINDS as readonly string[]).includes(value)
}

export function extForMediaMime(mime: string): 'jpg' | 'png' | 'webp' {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function siteMediaObjectPath(siteId: string, kind: SiteMediaKind, ext: string, id: string): string {
  return `sites/${siteId}/${kind}/${id}.${ext}`
}

export function publicSiteMediaUrl(supabaseUrl: string, path: string): string {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/${path}`
}

export function parseMediaUploadBody(body: unknown): {
  ok: true
  kind: SiteMediaKind
  mime: string
  buffer: Buffer
  siteIdHint: string | null
} | {
  ok: false
  error: string
} {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Cuerpo inválido' }
  }
  const record = body as Record<string, unknown>
  if (!isSiteMediaKind(record.kind)) {
    return { ok: false, error: 'kind inválido' }
  }
  const mime = typeof record.contentType === 'string' ? record.contentType : ''
  if (!SITE_MEDIA_ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'Solo JPEG, PNG o WebP.' }
  }
  const raw = typeof record.dataBase64 === 'string' ? record.dataBase64 : ''
  let buffer: Buffer
  try {
    buffer = Buffer.from(raw, 'base64')
  } catch {
    return { ok: false, error: 'Archivo inválido.' }
  }
  if (!buffer.length || buffer.length > SITE_MEDIA_MAX_BYTES) {
    return { ok: false, error: 'La imagen supera 5 MB o está vacía.' }
  }
  const siteIdHint =
    typeof record.siteId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.siteId)
      ? record.siteId
      : null
  return { ok: true, kind: record.kind, mime, buffer, siteIdHint }
}
