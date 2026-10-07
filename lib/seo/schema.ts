import { siteAbsoluteUrl } from '../site'

/**
 * JSON para <script type="application/ld+json">. Escapa `<` para que un texto
 * del owner (p. ej. "</script><script>…") no cierre el script y corra en el origen.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function generateWebPageSchema(params: {
  url: string
  title: string
  description: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: params.title,
    description: params.description,
    url: siteAbsoluteUrl(params.url),
  }
}

export function generateBreadcrumbListSchema(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: siteAbsoluteUrl(item.url),
    })),
  }
}
