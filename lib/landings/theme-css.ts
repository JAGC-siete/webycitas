/**
 * Tokens de tema → CSS. `theme.radius` es sm|md|lg, no un valor CSS.
 * El renderer inyecta --lp-radius como longitud.
 */

import type { LandingPageContent } from '../../types/landing'

export const LANDING_RADIUS_CSS = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '1rem',
} as const

export type LandingRadiusToken = keyof typeof LANDING_RADIUS_CSS

export function landingRadiusCss(radius: LandingRadiusToken | string): string {
  if (radius === 'sm' || radius === 'md' || radius === 'lg') return LANDING_RADIUS_CSS[radius]
  return LANDING_RADIUS_CSS.lg
}

const DEFAULT_ACCENT = '#3b82f6'
const ON_ACCENT_DARK = '#14110c'
const ON_ACCENT_LIGHT = '#ffffff'

function relativeLuminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join('') : match[1]
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(digits.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Text color for content painted on the accent: whichever of white or near-black reads better. */
export function onAccentColor(accent: string): string {
  const luminance = relativeLuminance(accent)
  if (luminance === null) return ON_ACCENT_LIGHT
  const dark = contrastRatio(luminance, relativeLuminance(ON_ACCENT_DARK) as number)
  const light = contrastRatio(luminance, 1)
  return light >= dark ? ON_ACCENT_LIGHT : ON_ACCENT_DARK
}

export function landingThemeCssVars(theme: LandingPageContent['theme']): {
  backgroundColor: string
  '--lp-primary': string
  '--lp-accent': string
  '--lp-on-accent': string
  '--lp-surface': string
  '--lp-radius': string
} {
  const accent = theme.accent || DEFAULT_ACCENT
  return {
    backgroundColor: theme.surface,
    '--lp-primary': theme.primary,
    '--lp-accent': accent,
    '--lp-on-accent': onAccentColor(accent),
    '--lp-surface': theme.surface,
    '--lp-radius': landingRadiusCss(theme.radius),
  }
}

export function heroLayoutClass(imageUrl?: string): string {
  return imageUrl
    ? 'grid items-center gap-8 text-left md:grid-cols-2'
    : 'mx-auto grid max-w-3xl grid-cols-1 gap-8 text-center'
}

export function heroCopyClass(imageUrl?: string): string {
  return imageUrl
    ? 'flex flex-col items-start space-y-6'
    : 'flex flex-col items-center space-y-6'
}
