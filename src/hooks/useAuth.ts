import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

/** Current Supabase session, kept live via onAuthStateChange. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let sb: ReturnType<typeof getSupabase>
    try {
      sb = getSupabase()
    } catch {
      // No env config: behave as signed out; Login surface will show the error.
      setLoading(false)
      return
    }

    let active = true
    sb.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })

    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}