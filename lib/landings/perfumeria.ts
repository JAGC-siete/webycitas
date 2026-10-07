/**
 * Plantilla de vitrina para perfumerías (frasco completo y decants).
 * Árbol: barra promo + hero → garantías → catálogo filtrable por ocasión →
 * banners destacados → carruseles por línea → FAQ → novedades → contacto.
 * No hay carrito: cada producto abre WhatsApp con el pedido ya escrito.
 * Lo dispara un hero.layout === 'boutique'.
 */

import {
  LANDING_SCHEMA_VERSION,
  type LandingBlock,
  type LandingPageBusiness,
  type LandingPageContent,
  type LandingPageContentInput,
} from './page-schema'
import { LANDING_STOCK } from './stock'

export const PERFUMERIA_THEME = {
  tone: 'dark' as const,
  primary: '#141210',
  accent: '#c9a24a',
  surface: '#0b0a09',
  font: 'serif' as const,
  radius: 'sm' as const,
}

const CONSENT_TEXT =
  'Acepto que esta perfumería me contacte por WhatsApp o correo con novedades y respuestas a mi consulta.'

export const PERFUMERIA_TEMPLATE_CONTENT: LandingPageContentInput = {
  version: LANDING_SCHEMA_VERSION,
  meta: {
    seoTitle: 'Perfumes originales y decants',
    seoDescription:
      'Perfumes de nicho, árabes y de diseñador en frasco completo o decant. Originales garantizados, envío a todo Honduras y pedido por WhatsApp.',
    keywords: 'perfumería, perfumes originales, decants, perfumes árabes, perfumes de nicho, Honduras',
    ogImageUrl: LANDING_STOCK.perfumeriaHero,
    noindex: false,
  },
  theme: PERFUMERIA_THEME,
  business: {
    name: 'Perfumería Tu Nombre',
    tagline: 'Fragancias originales en frasco completo o decant',
    address: 'Centro comercial, local 12',
    city: 'Tu ciudad',
    mapsQuery: 'perfumería cerca de mí',
    socials: {},
  },
  blocks: [
    {
      id: 'hero',
      kind: 'hero',
      layout: 'boutique',
      badge: 'Envío a todo Honduras · Decants desde L. 250',
      headline: 'Tu próxima fragancia favorita, original y a tu medida',
      subheadline:
        'Pruébala en decant antes de comprar el frasco completo. Te asesoramos por WhatsApp según la ocasión y tu estilo.',
      imageUrl: LANDING_STOCK.perfumeriaHero,
      primaryCta: { label: 'Ver catálogo', action: 'link', href: '#catalogo' },
      secondaryCta: {
        label: 'Asesoría por WhatsApp',
        action: 'whatsapp',
        message: 'Hola, quiero que me recomienden un perfume.',
      },
    },
    {
      id: 'garantias',
      kind: 'benefits',
      title: 'Compra con confianza',
      items: [
        {
          mark: '100%',
          title: 'Originales',
          body: 'Cada frasco viene de distribuidor verificado. Los decants se sacan del frasco original frente a ti si lo pides.',
        },
        {
          mark: 'HN',
          title: 'Envío nacional',
          body: 'Entregamos en la ciudad el mismo día y al resto del país por paquetería en 24 a 72 horas.',
        },
        {
          mark: 'L.',
          title: 'Pago seguro',
          body: 'Transferencia, depósito, tarjeta en tienda o pago contra entrega en la ciudad.',
        },
      ],
    },
    {
      id: 'catalogo',
      kind: 'items',
      title: 'Encuentra tu fragancia',
      subtitle: 'Filtra por ocasión. Precio de frasco completo; pregunta por el decant de cualquiera.',
      layout: 'grid',
      items: [
        {
          name: 'Ámbar Dorado',
          detail: 'Eau de Parfum 100 ml · ámbar, vainilla y maderas',
          category: 'Noche',
          priceLabel: 'L. 3,450',
          imageUrl: LANDING_STOCK.perfumeriaAmbar,
        },
        {
          name: 'Cítrico Mediterráneo',
          detail: 'Eau de Toilette 100 ml · bergamota, limón y vetiver',
          category: 'Oficina',
          priceLabel: 'L. 2,200',
          imageUrl: LANDING_STOCK.perfumeriaCitrico,
        },
        {
          name: 'Rosa Intensa',
          detail: 'Eau de Parfum 75 ml · rosa, pachulí y almizcle',
          category: 'Romántica',
          priceLabel: 'L. 2,950',
          imageUrl: LANDING_STOCK.perfumeriaRosa,
        },
        {
          name: 'Brisa Marina',
          detail: 'Eau de Toilette 100 ml · notas acuáticas y salvia',
          category: 'Diario',
          priceLabel: 'L. 1,850',
          imageUrl: LANDING_STOCK.perfumeriaMarino,
        },
        {
          name: 'Oud Ahumado',
          detail: 'Extrait 50 ml · oud, cuero e incienso',
          category: 'Formal',
          priceLabel: 'L. 4,900',
          imageUrl: LANDING_STOCK.perfumeriaOud,
        },
        {
          name: 'Vainilla Tabaco',
          detail: 'Eau de Parfum 100 ml · vainilla, tabaco y especias',
          category: 'Fiesta',
          priceLabel: 'L. 3,200',
          imageUrl: LANDING_STOCK.perfumeriaVainilla,
        },
      ],
    },
    {
      id: 'destacado-nicho',
      kind: 'cta',
      headline: 'Nicho: fragancias que no vas a oler en todos lados',
      subheadline:
        'Casas independientes con ingredientes de alta concentración. Pide el decant de 5 ml y decide con calma.',
      imageUrl: LANDING_STOCK.perfumeriaOud,
      primaryCta: {
        label: 'Quiero probar nicho',
        action: 'whatsapp',
        message: 'Hola, quiero probar perfumes de nicho en decant.',
      },
    },
    {
      id: 'decants',
      kind: 'items',
      title: 'Decants: nuevos y en tendencia',
      subtitle: 'Muestras de 5 y 10 ml en atomizador de vidrio, sacadas del frasco original.',
      layout: 'carousel',
      items: [
        { name: 'Decant Ámbar Dorado 10 ml', detail: 'Noche · larga duración', priceLabel: 'L. 420', imageUrl: LANDING_STOCK.perfumeriaAmbar },
        { name: 'Decant Oud Ahumado 5 ml', detail: 'Formal · intenso', priceLabel: 'L. 480', imageUrl: LANDING_STOCK.perfumeriaOud },
        { name: 'Decant Cítrico Mediterráneo 10 ml', detail: 'Oficina · fresco', priceLabel: 'L. 280', imageUrl: LANDING_STOCK.perfumeriaCitrico },
        { name: 'Decant Rosa Intensa 10 ml', detail: 'Romántica · floral', priceLabel: 'L. 360', imageUrl: LANDING_STOCK.perfumeriaRosa },
        { name: 'Decant Vainilla Tabaco 10 ml', detail: 'Fiesta · dulce especiado', priceLabel: 'L. 390', imageUrl: LANDING_STOCK.perfumeriaVainilla },
        { name: 'Decant Brisa Marina 10 ml', detail: 'Diario · acuático', priceLabel: 'L. 250', imageUrl: LANDING_STOCK.perfumeriaMarino },
      ],
    },
    {
      id: 'arabes',
      kind: 'items',
      title: 'Perfumes árabes',
      subtitle: 'Proyección fuerte y buena duración a precio accesible.',
      layout: 'carousel',
      items: [
        { name: 'Oud Real', detail: 'Eau de Parfum 100 ml · oud y azafrán', priceLabel: 'L. 1,450', imageUrl: LANDING_STOCK.perfumeriaOud },
        { name: 'Ámbar del Desierto', detail: 'Eau de Parfum 100 ml · ámbar y dátil', priceLabel: 'L. 1,250', imageUrl: LANDING_STOCK.perfumeriaAmbar },
        { name: 'Rosa de Taif', detail: 'Eau de Parfum 80 ml · rosa y almizcle blanco', priceLabel: 'L. 1,350', imageUrl: LANDING_STOCK.perfumeriaRosa },
        { name: 'Vainilla Sultana', detail: 'Eau de Parfum 100 ml · vainilla y caramelo', priceLabel: 'L. 1,150', imageUrl: LANDING_STOCK.perfumeriaVainilla },
      ],
    },
    {
      id: 'destacado-regalo',
      kind: 'cta',
      headline: 'Set de regalo armado a tu gusto',
      subheadline: 'Elige tres decants, los empacamos en caja con tarjeta y lo entregamos el mismo día en la ciudad.',
      imageUrl: LANDING_STOCK.perfumeriaVainilla,
      primaryCta: {
        label: 'Armar mi set',
        action: 'whatsapp',
        message: 'Hola, quiero armar un set de regalo con decants.',
      },
    },
    {
      id: 'preguntas',
      kind: 'faq',
      title: 'Preguntas frecuentes',
      items: [
        {
          question: '¿Qué es un decant?',
          answer:
            'Es una porción del perfume original pasada a un atomizador pequeño (5 o 10 ml). Sirve para probar la fragancia varios días antes de comprar el frasco completo.',
        },
        {
          question: '¿Cómo sé que son originales?',
          answer:
            'Compramos solo a distribuidores verificados y mostramos lote y empaque en tienda. Si quieres, sacamos tu decant del frasco frente a ti.',
        },
        {
          question: '¿Cuánto tarda el envío?',
          answer:
            'En la ciudad entregamos el mismo día si pides antes de las 3 p. m. Al resto del país, de 24 a 72 horas por paquetería.',
        },
        {
          question: '¿Qué formas de pago aceptan?',
          answer: 'Transferencia, depósito bancario, tarjeta en tienda y pago contra entrega dentro de la ciudad.',
        },
        {
          question: '¿Cómo conservo mi perfume?',
          answer: 'Lejos del sol y del calor, con la tapa puesta. Evita guardarlo en el baño o en el carro.',
        },
      ],
    },
    {
      id: 'horario',
      kind: 'hours',
      title: 'Horario de tienda',
      rows: [
        { label: 'Lunes a sábado', value: '10:00 – 19:00' },
        { label: 'Domingo', value: '11:00 – 17:00' },
      ],
      note: 'Pedidos por WhatsApp todos los días.',
    },
    {
      id: 'novedades',
      kind: 'leadForm',
      title: 'Entérate primero de lo nuevo',
      subtitle: 'Te avisamos cuando llegan lanzamientos, restocks y promociones de decants.',
      submitLabel: 'Quiero enterarme',
      consentText: CONSENT_TEXT,
      fields: { phone: true, message: false },
      successTitle: '¡Listo!',
      successBody: 'Te escribiremos cuando haya novedades. Sin spam.',
    },
    {
      id: 'contacto',
      kind: 'contact',
      title: 'Visítanos o escríbenos',
      note: 'Puedes oler cualquier fragancia en tienda antes de pedir tu decant.',
      showWhatsapp: true,
      showPhone: true,
      showEmail: true,
      showAddress: true,
      showMap: true,
    },
  ],
}

export function isPerfumeriaContent(content: LandingPageContent): boolean {
  return content.blocks.some((block) => block.kind === 'hero' && block.layout === 'boutique')
}

export type PerfumeriaItem = Extract<LandingBlock, { kind: 'items' }>['items'][number]

/** Ocasiones únicas en orden de aparición. Alimenta los chips de filtro. */
export function perfumeriaOccasions(items: readonly PerfumeriaItem[]): string[] {
  const seen = new Set<string>()
  for (const item of items) {
    const category = item.category?.trim()
    if (category) seen.add(category)
  }
  return [...seen]
}

export function perfumeriaItemsForOccasion(
  items: readonly PerfumeriaItem[],
  occasion: string | null
): PerfumeriaItem[] {
  if (!occasion) return [...items]
  return items.filter((item) => item.category?.trim() === occasion)
}

/** Pedido prellenado para WhatsApp. El precio va solo si se conoce. */
export function perfumeriaOrderMessage(
  business: Pick<LandingPageBusiness, 'name'>,
  itemName: string,
  priceText?: string,
  soldOut = false
): string {
  const price = priceText ? ` (${priceText})` : ''
  return soldOut
    ? `Hola ${business.name}, avísenme cuando vuelva a haber: ${itemName}.`
    : `Hola ${business.name}, me interesa: ${itemName}${price}. ¿Está disponible?`
}
