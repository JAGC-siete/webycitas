export const HONDURAS_TIMEZONE = 'America/Tegucigalpa'

export function getHondurasTimestamp(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: HONDURAS_TIMEZONE })
}

export function formatDateTimeForHonduras(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('es-HN', {
    timeZone: HONDURAS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimeForHonduras(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('es-HN', {
    timeZone: HONDURAS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "jueves 9 de octubre" — para encabezados de día. */
export function formatDayHeadingForHonduras(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-HN', {
    timeZone: HONDURAS_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Fecha YYYY-MM-DD del instante en hora de Honduras. */
export function hondurasDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-CA', { timeZone: HONDURAS_TIMEZONE })
}
