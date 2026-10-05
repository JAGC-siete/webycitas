/**
 * Disponibilidad interna del suite.
 * listOpenSlots alimenta booking público y validaciones owner.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { rangesOverlap } from './schemas'

export interface OpenSlot {
  starts_at: string
  ends_at: string
  staff_id: string
}

export async function listOpenSlots(
  supabase: SupabaseClient,
  input: {
    siteId: string
    day: string
    durationMin: number
    staffId?: string | null
  }
): Promise<OpenSlot[]> {
  const dayStart = new Date(`${input.day}T00:00:00-06:00`)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  let staffQuery = supabase
    .from('staff_members')
    .select('id, staff_schedules(weekday, start_time, end_time)')
    .eq('site_id', input.siteId)
    .eq('is_active', true)
  if (input.staffId) staffQuery = staffQuery.eq('id', input.staffId)

  const [{ data: staff }, { data: appts }, { data: blocks }] = await Promise.all([
    staffQuery,
    supabase
      .from('appointments')
      .select('staff_id, starts_at, ends_at, status')
      .eq('site_id', input.siteId)
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString())
      .in('status', ['pending', 'confirmed']),
    supabase
      .from('schedule_blocks')
      .select('staff_id, starts_at, ends_at')
      .eq('site_id', input.siteId)
      .lt('starts_at', dayEnd.toISOString())
      .gt('ends_at', dayStart.toISOString()),
  ])

  const weekday = dayStart.getUTCDay() // approximate; schedules use local weekday
  const localWeekday = new Date(`${input.day}T12:00:00-06:00`).getDay()
  const slots: OpenSlot[] = []
  const step = 15

  for (const member of staff ?? []) {
    const schedules = (member.staff_schedules as { weekday: number; start_time: string; end_time: string }[] | null) ?? []
    const daySchedules = schedules.filter((s) => s.weekday === localWeekday || s.weekday === weekday)
    if (daySchedules.length === 0) {
      // default 08:00-17:00 if no schedule
      daySchedules.push({ weekday: localWeekday, start_time: '08:00:00', end_time: '17:00:00' })
    }

    for (const schedule of daySchedules) {
      const [sh, sm] = schedule.start_time.split(':').map(Number)
      const [eh, em] = schedule.end_time.split(':').map(Number)
      let cursor = new Date(`${input.day}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00-06:00`)
      const windowEnd = new Date(`${input.day}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00-06:00`)

      while (cursor.getTime() + input.durationMin * 60_000 <= windowEnd.getTime()) {
        const end = new Date(cursor.getTime() + input.durationMin * 60_000)
        const busy = [...(appts ?? []), ...(blocks ?? [])].some((row) => {
          if (row.staff_id && row.staff_id !== member.id) return false
          return rangesOverlap(cursor, end, new Date(row.starts_at), new Date(row.ends_at))
        })
        if (!busy) {
          slots.push({
            starts_at: cursor.toISOString(),
            ends_at: end.toISOString(),
            staff_id: member.id,
          })
        }
        cursor = new Date(cursor.getTime() + step * 60_000)
      }
    }
  }

  return slots
}
