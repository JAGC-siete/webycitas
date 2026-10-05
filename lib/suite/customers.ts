import type { SupabaseClient } from '@supabase/supabase-js'

export async function upsertCustomerByPhone(
  supabase: SupabaseClient,
  siteId: string,
  input: { name: string; phone?: string | null; email?: string | null; notes?: string | null }
): Promise<string> {
  const phone = input.phone?.trim() || null
  if (phone) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('site_id', siteId)
      .eq('phone', phone)
      .maybeSingle()
    if (existing) {
      await supabase
        .from('customers')
        .update({
          name: input.name,
          email: input.email || null,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .eq('id', existing.id)
      return existing.id as string
    }
  }
  const { data, error } = await supabase
    .from('customers')
    .insert({
      site_id: siteId,
      name: input.name,
      phone,
      email: input.email || null,
      notes: input.notes || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
