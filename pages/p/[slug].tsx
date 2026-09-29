import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import LandingRenderer from '../../components/landings/LandingRenderer'
import { SITE_PUBLIC_COLUMNS, SITES_TABLE, toPublicLandingPage } from '../../lib/landings/db'
import { landingLocalBusinessJsonLd } from '../../lib/landings/jsonld'
import { landingPublicUrl } from '../../lib/landings/paths'
import { createPublicClient } from '../../lib/supabase/public'
import { siteAbsoluteUrl } from '../../lib/site'
import { logger } from '../../lib/logger'
import type { LandingPagePublicRow, PublicLandingPage } from '../../types/landing'

interface PublicLandingPageProps {
  page: PublicLandingPage
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export default function PublicLandingPageView({ page }: PublicLandingPageProps) {
  const { meta } = page.content
  const canonical = landingPublicUrl(page.slug)
  const jsonLd = landingLocalBusinessJsonLd(page)

  return (
    <>
      <Head>
        <title>{meta.seoTitle}</title>
        <meta name="description" content={meta.seoDescription} />
        {meta.keywords && <meta name="keywords" content={meta.keywords} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {meta.noindex ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : (
          <meta name="robots" content="index, follow" />
        )}
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={meta.seoTitle} />
        <meta property="og:description" content={meta.seoDescription} />
        <meta property="og:url" content={canonical} />
        {meta.ogImageUrl && (
          <meta property="og:image" content={siteAbsoluteUrl(meta.ogImageUrl)} />
        )}
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}
      </Head>
      <LandingRenderer page={page} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<PublicLandingPageProps> = async (ctx) => {
  const raw = ctx.params?.slug
  const slug = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase().trim() ?? ''

  if (!slug || !SLUG_PATTERN.test(slug) || slug.length > 63) {
    return { notFound: true }
  }

  let row: LandingPagePublicRow | null = null

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from(SITES_TABLE)
      .select(SITE_PUBLIC_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (error) {
      logger.error('Error leyendo site publicado', { slug, error: error.message })
      return { notFound: true }
    }

    row = (data as LandingPagePublicRow | null) ?? null
  } catch (err: unknown) {
    logger.error('Fallo el cliente público de sites', {
      slug,
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return { notFound: true }
  }

  if (!row) {
    return { notFound: true }
  }

  const page = toPublicLandingPage(row)
  if (!page) {
    return { notFound: true }
  }

  ctx.res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')

  return { props: { page } }
}
