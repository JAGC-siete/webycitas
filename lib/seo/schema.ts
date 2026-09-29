import { siteAbsoluteUrl } from '../site'

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
