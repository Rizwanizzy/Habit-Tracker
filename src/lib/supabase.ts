import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** Lazily create the Supabase client from VITE_ env vars. Throws a clear error if missing. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    }
    client = createClient(url, key)
  }
  return client
}