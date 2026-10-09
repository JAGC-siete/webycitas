/**
 * Actividad reciente del Panel: une solicitudes y cancelaciones en una sola lista.
 * Antes se mostraban unas u otras, nunca juntas.
 */

export interface DashboardAlert {
  type: string
  id: string
  title: string
  at: string
}

export interface RecentInquiry {
  id: string
  full_name: string
  created_at: string
}

export interface ActivityItem {
  key: string
  kind: 'inquiry' | 'cancellation' | 'other'
  title: string
  at: string
}

export function buildActivityFeed(
  alerts: DashboardAlert[],
  recent: RecentInquiry[],
  limit = 8
): ActivityItem[] {
  const items = new Map<string, ActivityItem>()
  for (const row of recent) {
    items.set(`inquiry-${row.id}`, {
      key: `inquiry-${row.id}`,
      kind: 'inquiry',
      title: `Te escribió ${row.full_name}`,
      at: row.created_at,
    })
  }
  for (const alert of alerts) {
    const kind = alert.type === 'inquiry' || alert.type === 'cancellation' ? alert.type : 'other'
    const key = `${alert.type}-${alert.id}`
    // Las solicitudes ya vienen de `recent` con un título más claro.
    if (kind === 'inquiry' && items.has(key)) continue
    items.set(key, {
      key,
      kind,
      title: kind === 'cancellation' ? alert.title.replace(/^Cancelación:/, 'Cita cancelada:') : alert.title,
      at: alert.at,
    })
  }
  return Array.from(items.values())
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}
