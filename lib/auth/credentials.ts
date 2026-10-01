const INVISIBLE = /[\u200B-\u200D\uFEFF\u00A0]/g

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(INVISIBLE, '').trim().toLowerCase()
}

export function normalizePassword(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(INVISIBLE, '')
}

export function isUsableEmail(email: string): boolean {
  return email.includes('@') && email.length >= 5 && email.length <= 254
}
