/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
  /** Supabase project URL (NOT secret — RLS + anon key are public by design). */
  readonly VITE_SUPABASE_URL: string
  /** Supabase anon key (public by design; never the service role key). */
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Web Push VAPID public key. The private key stays server-side (Pass 3 Worker). */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
