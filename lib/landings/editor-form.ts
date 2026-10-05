/**
 * Helpers del formulario del editor ops: limpieza RHF + schema con meta de página.
 */

import { z } from 'zod'
import {
  landingPageContentSchema,
  landingSlugSchema,
  type LandingPageContentInput,
} from './page-schema'

export function emptyStringsToUndefined(value: unknown): unknown {
  if (value === '') return undefined
  if (Array.isArray(value)) return value.map(emptyStringsToUndefined)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        emptyStringsToUndefined(nested),
      ])
    )
  }
  return value
}

export function scrubEmptySecondaryCtas(content: LandingPageContentInput): LandingPageContentInput {
  const blocks = (content.blocks ?? []).map((block) => {
    if (!('secondaryCta' in block) || !block.secondaryCta) return block
    const label = block.secondaryCta.label
    if (!label || !String(label).trim()) {
      const { secondaryCta: _drop, ...rest } = block as typeof block & { secondaryCta?: unknown }
      return rest
    }
    return block
  })
  return { ...content, blocks: blocks as LandingPageContentInput['blocks'] }
}

export function prepareEditorFormValues(value: unknown): unknown {
  const cleaned = emptyStringsToUndefined(value)
  if (!cleaned || typeof cleaned !== 'object') return cleaned
  const record = cleaned as Record<string, unknown>
  if (!Array.isArray(record.blocks)) return cleaned
  return scrubEmptySecondaryCtas(cleaned as LandingPageContentInput)
}

const notifyEmailField = z
  .union([z.string().trim().email(), z.literal('')])
  .optional()
  .transform((v) => (v === '' || v === undefined ? undefined : v))

const editorMetaFields = {
  _title: z.string().trim().min(2).max(120),
  _notifyEmail: notifyEmailField,
} as const

/** Ops: puede renombrar slug. */
export const editorFormSchema = z.preprocess(
  prepareEditorFormValues,
  landingPageContentSchema.extend({
    ...editorMetaFields,
    _slug: landingSlugSchema,
  })
)

/** Suite: slug solo lectura (no se valida como renombre). */
export const suiteEditorFormSchema = z.preprocess(
  prepareEditorFormValues,
  landingPageContentSchema.extend({
    ...editorMetaFields,
    _slug: z.string().optional(),
  })
)

export type EditorFormParsed = z.output<typeof editorFormSchema>
