/**
 * Plan de cuentas del site: listar, crear, seed plantilla.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../../../../lib/logger'
import { createAccountSchema } from '../../../../../lib/suite/accounting/schemas'
import { requireSuiteApi } from '../../../../../lib/suite/tenant'

const ACCOUNTS_TABLE = 'accounting_accounts'
const UNIQUE_VIOLATION = '23505'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'contabilidad' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })

  const siteId = ctx.tenant.site.id

  try {
    if (req.method === 'GET') {
      const { data, error } = await ctx.supabase
        .from(ACCOUNTS_TABLE)
        .select('*')
        .eq('site_id', siteId)
        .order('code', { ascending: true })

      if (error) {
        logger.error('Error listando cuentas', { siteId, error: error.message })
        return res.status(500).json({ error: 'No se pudo cargar el plan de cuentas' })
      }
      return res.status(200).json({ accounts: data ?? [] })
    }

    if (req.method === 'POST') {
      const body = req.body as { action?: string }

      if (body?.action === 'seed') {
        const { data: inserted, error: seedError } = await ctx.supabase.rpc(
          'accounting_seed_default_coa',
          { p_site_id: siteId }
        )
        if (seedError) {
          logger.error('Error seeding COA', { siteId, error: seedError.message })
          return res.status(500).json({ error: 'No se pudo cargar la plantilla' })
        }
        const { data, error } = await ctx.supabase
          .from(ACCOUNTS_TABLE)
          .select('*')
          .eq('site_id', siteId)
          .order('code', { ascending: true })
        if (error) {
          return res.status(500).json({ error: 'Plantilla cargada pero no se pudo listar' })
        }
        return res.status(200).json({ inserted: inserted ?? 0, accounts: data ?? [] })
      }

      const parsed = createAccountSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
      }

      const { data, error } = await ctx.supabase
        .from(ACCOUNTS_TABLE)
        .insert({
          site_id: siteId,
          code: parsed.data.code,
          name: parsed.data.name,
          account_type: parsed.data.account_type,
          normal_balance: parsed.data.normal_balance,
          parent_id: parsed.data.parent_id,
          is_postable: parsed.data.is_postable,
          is_active: parsed.data.is_active,
        })
        .select('*')
        .single()

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          return res.status(409).json({ error: 'Ya existe una cuenta con ese código.' })
        }
        logger.error('Error creando cuenta', { siteId, error: error.message })
        return res.status(500).json({ error: 'No se pudo crear la cuenta' })
      }
      return res.status(201).json({ account: data })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en plan de cuentas'
    return res.status(500).json({ error: message })
  }
}
