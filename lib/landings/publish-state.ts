/**
 * Borrador vs. versión publicada de un site.
 *
 * El editor guarda en content_json y la página pública lee published_content_json.
 * Las APIs del editor devuelven `has_unpublished_changes` en lugar de la copia publicada.
 */

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    )
  }
  return value
}

export function sameLandingContent(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null))
}

/** Solo un site publicado puede tener cambios pendientes de publicar. */
export function hasUnpublishedChanges(row: {
  status: string
  content_json: unknown
  published_content_json: unknown
}): boolean {
  if (row.status !== 'published') return false
  return !sameLandingContent(row.content_json, row.published_content_json)
}

export function withPublishState<T extends { status: string; content_json: unknown; published_content_json: unknown }>(
  row: T
): Omit<T, 'published_content_json'> & { has_unpublished_changes: boolean } {
  const { published_content_json: _published, ...rest } = row
  return { ...rest, has_unpublished_changes: hasUnpublishedChanges(row) }
}
