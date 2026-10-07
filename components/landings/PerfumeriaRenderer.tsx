/**
 * Vitrina boutique para perfumerías: barra promo, hero oscuro, garantías,
 * catálogo filtrable por ocasión, carruseles y banners destacados.
 * Sin carrito: cada producto abre WhatsApp con el pedido escrito.
 * Respeta el orden de content.blocks. Lo dispara un hero.layout === 'boutique'.
 */

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { callHref, mapsHref, resolveCta, whatsappHref } from '../../lib/landings/cta'
import { formatInventoryPrice, type PublicInventoryOffer } from '../../lib/landings/inventory'
import {
  perfumeriaItemsForOccasion,
  perfumeriaOccasions,
  perfumeriaOrderMessage,
  type PerfumeriaItem,
} from '../../lib/landings/perfumeria'
import { landingThemeCssVars } from '../../lib/landings/theme-css'
import { cn } from '../../lib/utils'
import type { LandingBlock, LandingPageBusiness, PublicLandingPage } from '../../types/landing'
import LandingLeadForm from './LandingLeadForm'
import styles from './perfumeria.module.css'

interface PerfumeriaRendererProps {
  page: PublicLandingPage
  stockByProductId?: Record<string, PublicInventoryOffer>
}

type BlockOf<K extends LandingBlock['kind']> = Extract<LandingBlock, { kind: K }>

interface ShopContext {
  business: LandingPageBusiness
  leadFormAnchor: string | null
  slug: string
  stockByProductId?: Record<string, PublicInventoryOffer>
}

export default function PerfumeriaRenderer({ page, stockByProductId }: PerfumeriaRendererProps) {
  const { theme, business, blocks } = page.content
  const visible = blocks.filter((block) => block.visible)
  const hero = visible.find((block): block is BlockOf<'hero'> => block.kind === 'hero')
  const lines = visible.filter((block): block is BlockOf<'items'> => block.kind === 'items')
  const faq = visible.find((block) => block.kind === 'faq')
  const leadFormAnchor = visible.find((block) => block.kind === 'leadForm')?.id ?? null
  const whatsapp = whatsappHref(business, `Hola ${business.name}, quiero hacer un pedido.`)
  const instagram = business.socials.instagram

  const context: ShopContext = {
    business,
    leadFormAnchor,
    slug: page.slug,
    stockByProductId,
  }
  let spotlightIndex = 0

  return (
    <div
      className={cn(
        styles.shell,
        theme.font === 'serif' ? 'font-serif' : 'font-sans',
        theme.tone === 'light' && styles.shellLight
      )}
      style={landingThemeCssVars(theme) as CSSProperties}
    >
      {hero?.badge ? <p className={styles.promo}>{hero.badge}</p> : null}

      <div className={styles.chrome}>
        <header className={styles.header}>
          <a href="#hero" className={styles.brand}>
            {business.name}
          </a>
          <nav className={styles.nav} aria-label="Colecciones">
            {lines.map((line) => (
              <a key={line.id} href={`#${line.id}`}>
                {line.title}
              </a>
            ))}
            {faq ? <a href={`#${faq.id}`}>Preguntas</a> : null}
            {instagram ? (
              <a href={instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            ) : null}
          </nav>
          {whatsapp ? (
            <a href={whatsapp} className={styles.headerCta} target="_blank" rel="noopener noreferrer">
              Pedir por WhatsApp
            </a>
          ) : null}
        </header>
      </div>

      <main className={styles.main}>
        {visible.map((block) => {
          switch (block.kind) {
            case 'hero':
              return <HeroBlock key={block.id} block={block} context={context} />
            case 'benefits':
              return <TrustBlock key={block.id} block={block} />
            case 'items':
              return block.layout === 'carousel' ? (
                <CarouselBlock key={block.id} block={block} context={context} />
              ) : (
                <CatalogBlock key={block.id} block={block} context={context} />
              )
            case 'cta':
              return <SpotlightBlock key={block.id} block={block} context={context} flip={spotlightIndex++ % 2 === 1} />
            case 'gallery':
              return <GalleryBlock key={block.id} block={block} />
            case 'text':
              return (
                <Section key={block.id} id={block.id} title={block.title}>
                  <p className={styles.prose}>{block.body}</p>
                </Section>
              )
            case 'testimonials':
              return <TestimonialsBlock key={block.id} block={block} />
            case 'faq':
              return <FaqBlock key={block.id} block={block} />
            case 'hours':
              return <HoursBlock key={block.id} block={block} />
            case 'leadForm':
              return (
                <Section key={block.id} id={block.id} title={block.title} subtitle={block.subtitle} centered>
                  <div className={styles.formCard} style={{ '--lp-primary': theme.accent } as CSSProperties}>
                    <LandingLeadForm block={block} slug={page.slug} />
                  </div>
                </Section>
              )
            case 'contact':
              return <ContactBlock key={block.id} block={block} business={business} />
            default:
              return null
          }
        })}
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerBrand}>{business.name}</p>
        {business.tagline ? <p className={styles.footerTagline}>{business.tagline}</p> : null}
        <div className={styles.footerLinks}>
          {business.socials.instagram ? (
            <a href={business.socials.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          ) : null}
          {business.socials.facebook ? (
            <a href={business.socials.facebook} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
          ) : null}
          {business.socials.tiktok ? (
            <a href={business.socials.tiktok} target="_blank" rel="noopener noreferrer">
              TikTok
            </a>
          ) : null}
        </div>
        <p className={styles.footerFine}>
          © {new Date().getFullYear()} {business.name}
          {business.city ? ` · ${business.city}` : ''}
        </p>
      </footer>

      {whatsapp ? (
        <div className={styles.dock}>
          <a href={whatsapp} className={styles.dockCta} target="_blank" rel="noopener noreferrer">
            Pedir por WhatsApp
          </a>
        </div>
      ) : null}
    </div>
  )
}

/* ----------------------------- primitivas ----------------------------- */

function Section({
  id,
  title,
  subtitle,
  centered = false,
  children,
}: {
  id: string
  title?: string
  subtitle?: string
  centered?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className={cn(styles.section, centered && styles.sectionCentered)}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      {subtitle ? <p className={styles.sectionLead}>{subtitle}</p> : null}
      {children}
    </section>
  )
}

function CtaAnchor({
  cta,
  context,
  variant,
}: {
  cta: BlockOf<'hero'>['primaryCta']
  context: ShopContext
  variant: 'solid' | 'ghost'
}) {
  const resolved = resolveCta(cta, context.business, context.leadFormAnchor)
  if (!resolved) return null
  return (
    <a
      href={resolved.href}
      className={variant === 'solid' ? styles.ctaSolid : styles.ctaGhost}
      {...(resolved.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {resolved.label}
    </a>
  )
}

/* ------------------------------- bloques ------------------------------ */

function HeroBlock({ block, context }: { block: BlockOf<'hero'>; context: ShopContext }) {
  return (
    <section
      id={block.id}
      className={styles.hero}
      style={block.imageUrl ? ({ '--hero-image': `url(${block.imageUrl})` } as CSSProperties) : undefined}
    >
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{block.headline}</h1>
        {block.subheadline ? <p className={styles.heroLead}>{block.subheadline}</p> : null}
        <div className={styles.heroCtas}>
          <CtaAnchor cta={block.primaryCta} context={context} variant="solid" />
          {block.secondaryCta ? <CtaAnchor cta={block.secondaryCta} context={context} variant="ghost" /> : null}
        </div>
      </div>
    </section>
  )
}

function TrustBlock({ block }: { block: BlockOf<'benefits'> }) {
  return (
    <section id={block.id} className={styles.trust} aria-label={block.title}>
      {block.items.map((item) => (
        <article key={item.title} className={styles.trustItem}>
          <span className={styles.trustMark}>{item.mark}</span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </article>
      ))}
    </section>
  )
}

function CatalogBlock({ block, context }: { block: BlockOf<'items'>; context: ShopContext }) {
  const occasions = perfumeriaOccasions(block.items)
  const [occasion, setOccasion] = useState<string | null>(null)
  const shown = perfumeriaItemsForOccasion(block.items, occasion)

  return (
    <Section id={block.id} title={block.title} subtitle={block.subtitle} centered>
      {occasions.length > 1 ? (
        <div className={styles.chips} role="group" aria-label="Filtrar por ocasión">
          <button type="button" aria-pressed={occasion === null} onClick={() => setOccasion(null)}>
            Todas
          </button>
          {occasions.map((name) => (
            <button key={name} type="button" aria-pressed={occasion === name} onClick={() => setOccasion(name)}>
              {name}
            </button>
          ))}
        </div>
      ) : null}
      <div className={block.layout === 'list' ? styles.list : styles.grid}>
        {shown.map((item, index) => (
          <ProductCard key={`${block.id}-${item.name}-${index}`} item={item} context={context} />
        ))}
      </div>
    </Section>
  )
}

function CarouselBlock({ block, context }: { block: BlockOf<'items'>; context: ShopContext }) {
  const track = useRef<HTMLDivElement>(null)

  function scroll(direction: 1 | -1) {
    const node = track.current
    if (!node) return
    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: 'smooth',
    })
  }

  return (
    <section id={block.id} className={styles.section}>
      <div className={styles.carouselHead}>
        <div>
          <h2 className={styles.sectionTitle}>{block.title}</h2>
          {block.subtitle ? <p className={styles.sectionLead}>{block.subtitle}</p> : null}
        </div>
        <div className={styles.carouselArrows}>
          <button type="button" aria-label="Anterior" onClick={() => scroll(-1)}>
            ‹
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => scroll(1)}>
            ›
          </button>
        </div>
      </div>
      <div ref={track} className={styles.carousel}>
        {block.items.map((item, index) => (
          <ProductCard key={`${block.id}-${item.name}-${index}`} item={item} context={context} />
        ))}
      </div>
    </section>
  )
}

function ProductCard({ item, context }: { item: PerfumeriaItem; context: ShopContext }) {
  const offer = item.inventoryProductId ? context.stockByProductId?.[item.inventoryProductId] : undefined
  const priceText = offer ? formatInventoryPrice(offer.precio) : item.priceLabel
  const soldOut = Boolean(offer && offer.stockActual === 0)
  const orderHref = whatsappHref(
    context.business,
    perfumeriaOrderMessage(context.business, item.name, priceText, soldOut)
  )
  const fallbackHref = context.leadFormAnchor ? `#${context.leadFormAnchor}` : null
  const href = orderHref ?? fallbackHref

  return (
    <article className={styles.card}>
      <div className={styles.cardMedia}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" />
        ) : (
          <span className={styles.cardMonogram} aria-hidden>
            {item.name.slice(0, 1)}
          </span>
        )}
        {soldOut ? <span className={styles.cardBadge}>Agotado</span> : null}
        {!soldOut && item.category ? <span className={styles.cardTag}>{item.category}</span> : null}
      </div>
      <div className={styles.cardBody}>
        <h3>{item.name}</h3>
        {item.detail ? <p className={styles.cardDetail}>{item.detail}</p> : null}
        <div className={styles.cardFoot}>
          {priceText ? <span className={styles.cardPrice}>{priceText}</span> : <span />}
          {href ? (
            <a
              href={href}
              className={styles.cardCta}
              {...(orderHref ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {soldOut ? 'Avisarme' : orderHref ? 'Pedir' : 'Consultar'}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function SpotlightBlock({ block, context, flip }: { block: BlockOf<'cta'>; context: ShopContext; flip: boolean }) {
  return (
    <section id={block.id} className={cn(styles.spotlight, flip && styles.spotlightFlip)}>
      {block.imageUrl ? (
        <div className={styles.spotlightMedia}>
          <img src={block.imageUrl} alt={block.headline} loading="lazy" />
        </div>
      ) : null}
      <div className={styles.spotlightCopy}>
        <h2>{block.headline}</h2>
        {block.subheadline ? <p>{block.subheadline}</p> : null}
        <CtaAnchor cta={block.primaryCta} context={context} variant="solid" />
      </div>
    </section>
  )
}

function GalleryBlock({ block }: { block: BlockOf<'gallery'> }) {
  return (
    <Section id={block.id} title={block.title} centered>
      <div className={styles.brands}>
        {block.images.map((image) => (
          <img key={image.url} src={image.url} alt={image.alt} loading="lazy" />
        ))}
      </div>
    </Section>
  )
}

function TestimonialsBlock({ block }: { block: BlockOf<'testimonials'> }) {
  return (
    <Section id={block.id} title={block.title} centered>
      <div className={styles.quotes}>
        {block.items.map((item) => (
          <blockquote key={item.author}>
            <p>“{item.quote}”</p>
            <footer>
              {item.author}
              {item.role ? <span> · {item.role}</span> : null}
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  )
}

function FaqBlock({ block }: { block: BlockOf<'faq'> }) {
  return (
    <Section id={block.id} title={block.title} centered>
      <div className={styles.faq}>
        {block.items.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

function HoursBlock({ block }: { block: BlockOf<'hours'> }) {
  return (
    <Section id={block.id} title={block.title} centered>
      <dl className={styles.rows}>
        {block.rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {block.note ? <p className={styles.note}>{block.note}</p> : null}
    </Section>
  )
}

function ContactBlock({ block, business }: { block: BlockOf<'contact'>; business: LandingPageBusiness }) {
  const whatsapp = whatsappHref(business, `Hola ${business.name}, tengo una consulta.`)
  const call = callHref(business)
  const maps = mapsHref(business)

  return (
    <Section id={block.id} title={block.title} subtitle={block.note} centered>
      <dl className={styles.rows}>
        {block.showWhatsapp && whatsapp && business.whatsapp ? (
          <div>
            <dt>WhatsApp</dt>
            <dd>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                {business.whatsapp}
              </a>
            </dd>
          </div>
        ) : null}
        {block.showPhone && business.phone && call ? (
          <div>
            <dt>Teléfono</dt>
            <dd>
              <a href={call}>{business.phone}</a>
            </dd>
          </div>
        ) : null}
        {block.showEmail && business.email ? (
          <div>
            <dt>Correo</dt>
            <dd>
              <a href={`mailto:${business.email}`}>{business.email}</a>
            </dd>
          </div>
        ) : null}
        {block.showAddress && business.address ? (
          <div>
            <dt>Dirección</dt>
            <dd>{business.address}</dd>
          </div>
        ) : null}
        {block.showMap && maps ? (
          <div>
            <dt>Mapa</dt>
            <dd>
              <a href={maps} target="_blank" rel="noopener noreferrer">
                Abrir en Google Maps
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </Section>
  )
}
