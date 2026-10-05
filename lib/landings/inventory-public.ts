/**
 * Saldo que ve /p/[slug]. Solo precio y stock de los ids citados en el snapshot.
 * anon no lee products: service role + filtro por site.
 */

import { createAdminClient } from '../supabase/admin'
import type { PublicInventoryOffer } from './inventory'
import { PRODUCTS_TABLE } from './inventory-server'
import { LEADS_TABLE } from './db'

interface OfferRow {
  id: string
  precio: number | string
  stock_actual: number
}

export async function readPublishedInventory(
  siteId: string,
  productIds: string[]
): Promise<{ live: boolean; offers: Record<string, PublicInventoryOffer> }> {
  if (productIds.length === 0) return { live: false, offers: {} }

  const admin = createAdminClient()

  const { data: lead, error: leadError } = await admin
    .from(LEADS_TABLE)
    .select('services')
    .eq('site_id', siteId)
    .maybeSingle()

  if (leadError) throw new Error(leadError.message)

  const services = (lead as { services?: string[] | null } | null)?.services ?? []
  if (!services.includes('inventory')) return { live: false, offers: {} }

  const { data, error } = await admin
    .from(PRODUCTS_TABLE)
    .select('id, precio, stock_actual')
    .eq('site_id', siteId)
    .in('id', productIds)

  if (error) throw new Error(error.message)

  const offers: Record<string, PublicInventoryOffer> = {}
  for (const row of (data ?? []) as OfferRow[]) {
    offers[row.id] = {
      precio: typeof row.precio === 'number' ? row.precio : Number(row.precio),
      stockActual: row.stock_actual,
    }
  }
  return { live: true, offers }
}
