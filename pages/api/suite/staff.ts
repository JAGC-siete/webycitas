import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSuiteApi } from '../../../lib/suite/tenant'
import { staffCreateSchema, staffPatchSchema } from '../../../lib/suite/schemas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireSuiteApi(req, res, { module: 'reservas' })
  if (!ctx) return
  if (!ctx.tenant.site) return res.status(400).json({ error: 'Sin sitio' })
  const siteId = ctx.tenant.site.id

  try {
    if (req.method === 'GET') {
      const { data, error } = await ctx.supabase
        .from('staff_members')
        .select(
          'id, name, color, bio, image_url, is_active, sort_order, staff_schedules(id, weekday, start_time, end_time), staff_services(service_id)'
        )
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return res.status(200).json({ staff: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = staffCreateSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const body = parsed.data
      const { data: member, error } = await ctx.supabase
        .from('staff_members')
        .insert({
          site_id: siteId,
          name: body.name,
          color: body.color || '#38bdf8',
          bio: body.bio || null,
          image_url: body.image_url || null,
          is_active: body.is_active ?? true,
        })
        .select('*')
        .single()
      if (error) throw error

      if (body.schedules?.length) {
        await ctx.supabase.from('staff_schedules').insert(
          body.schedules.map((s) => ({
            staff_id: member.id,
            weekday: s.weekday,
            start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
            end_time: s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time,
          }))
        )
      }
      if (body.service_ids?.length) {
        await ctx.supabase.from('staff_services').insert(
          body.service_ids.map((service_id) => ({ staff_id: member.id, service_id }))
        )
      }
      return res.status(201).json({ staff: member })
    }

    if (req.method === 'PATCH') {
      const parsed = staffPatchSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
      const { id, service_ids, schedules, ...rest } = parsed.data
      const patch: Record<string, unknown> = {}
      if (rest.name !== undefined) patch.name = rest.name
      if (rest.color !== undefined) patch.color = rest.color
      if (rest.bio !== undefined) patch.bio = rest.bio
      if (rest.image_url !== undefined) patch.image_url = rest.image_url || null
      if (rest.is_active !== undefined) patch.is_active = rest.is_active

      const { data, error } = await ctx.supabase
        .from('staff_members')
        .update(patch)
        .eq('id', id)
        .eq('site_id', siteId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Miembro no encontrado' })

      if (schedules) {
        await ctx.supabase.from('staff_schedules').delete().eq('staff_id', id)
        if (schedules.length) {
          await ctx.supabase.from('staff_schedules').insert(
            schedules.map((s) => ({
              staff_id: id,
              weekday: s.weekday,
              start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
              end_time: s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time,
            }))
          )
        }
      }
      if (service_ids) {
        await ctx.supabase.from('staff_services').delete().eq('staff_id', id)
        if (service_ids.length) {
          await ctx.supabase
            .from('staff_services')
            .insert(service_ids.map((service_id) => ({ staff_id: id, service_id })))
        }
      }
      return res.status(200).json({ staff: data })
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en equipo'
    return res.status(500).json({ error: message })
  }
}
