import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// With @supabase/ssr 0.12 (the version Webycitas pins) the plain SupabaseClient annotation compiles again.
type BrowserSupabaseClient = SupabaseClient

let cached: BrowserSupabaseClient | null = null

export function createBrowserSupabaseClient(): BrowserSupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  cached = createBrowserClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  return cached
}
