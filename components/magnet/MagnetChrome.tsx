import type { ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Button } from '../ui/button'
import { trackCTAClick } from '../../lib/analytics/googleAds'
import { APP_LOGIN_PATH } from '../../lib/ops/paths'
import { serializeJsonLd } from '../../lib/seo/schema'
import { siteAbsoluteUrl } from '../../lib/site'

export default function MagnetChrome({
  title,
  description,
  keywords,
  canonicalPath,
  jsonLd,
  ctaLabel,
  children,
}: {
  title: string
  description: string
  keywords?: string
  canonicalPath: string
  jsonLd: unknown
  ctaLabel: string
  children: ReactNode
}) {
  const canonical = siteAbsoluteUrl(canonicalPath)

  function scrollToForm() {
    trackCTAClick(ctaLabel, 'header')
    document.getElementById('solicitud')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex min-h-screen flex-col bg-mesh text-white">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {keywords ? <meta name="keywords" content={keywords} /> : null}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </Head>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-wide text-white">
            Webycitas
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="outline" size="sm" className="min-h-[40px] px-3 sm:px-4">
              <Link
                href={APP_LOGIN_PATH}
                onClick={() => trackCTAClick('iniciar_sesion', 'header')}
              >
                Iniciar sesión
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="btn-shiny min-h-[40px] bg-green-600 px-4 font-semibold hover:bg-green-700"
              onClick={scrollToForm}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </header>
      <main className="flex flex-col">{children}</main>
    </div>
  )
}
