import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { extractError } from './useHabits'
import { isDayStartHour, type DayStartHour } from '../lib/dates'
import { now } from '../lib/clock'

const LS_KEY = 'day-start-hour'

function cachedDayStartHour(): DayStartHour {
  try {
    const v = Number(localStorage.getItem(LS_KEY))
    return isDayStartHour(v) ? v : 0
  } catch {
    return 0
  }
}

function cacheDayStartHour(hour: DayStartHour) {
  try {
    localStorage.setItem(LS_KEY, String(hour))
  } catch {
    // Storage disabled: the next session just starts from 0 again.
  }
}

/** The user's day-start setting (user_settings, one row per user, may not
 *  exist yet → treated as 0). The initial value comes from the
 *  localStorage cache so the first paint already uses the right day; the
 *  network answer then refines it. setDayStartHour updates optimistically,
 *  upserts with `onConflict: 'user_id'`, and rolls back + exposes the error
 *  on failure. */
export function useUserSettings() {
  const [dayStartHour, setDayStartHourState] = useState<DayStartHour>(cachedDayStartHour)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Mirror for the setter + rollback (written in an effect, never during
  // render, to avoid stale-closure races without touching state directly).
  const hourRef = useRef<DayStartHour>(0)
  useEffect(() => {
    hourRef.current = dayStartHour
  }, [dayStartHour])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const sb = getSupabase()
        const { data: userData, error: userError } = await sb.auth.getUser()
        if (userError) throw userError
        if (!userData.user) throw new Error('You must be signed in')
        // maybeSingle: the row may not exist yet.
        const { data, error } = await sb
          .from('user_settings')
          .select('day_start_hour')
          .eq('user_id', userData.user.id)
          .maybeSingle()
        if (error) throw error
        if (!active) return
        const raw = data == null ? 0 : Number(data.day_start_hour)
        const hour: DayStartHour = isDayStartHour(raw) ? raw : 0
        setDayStartHourState(hour)
        cacheDayStartHour(hour)
        setError(null)
      } catch (e) {
        if (active) setError(extractError(e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const setDayStartHour = useCallback(async (hour: number) => {
    if (!isDayStartHour(hour)) return
    const prev = hourRef.current
    if (hour === prev) return
    setDayStartHourState(hour)
    cacheDayStartHour(hour)
    try {
      const sb = getSupabase()
      const { data: userData, error: userError } = await sb.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw new Error('You must be signed in')
      const { error } = await sb
        .from('user_settings')
        .upsert(
          { user_id: userData.user.id, day_start_hour: hour, updated_at: now().toISOString() },
          { onConflict: 'user_id' },
        )
      if (error) throw error
      setError(null)
    } catch (e) {
      setDayStartHourState(prev)
      cacheDayStartHour(prev)
      setError(extractError(e))
      throw e
    }
  }, [])

  return { dayStartHour, loading, error, setDayStartHour }
}

export type UserSettings = ReturnType<typeof useUserSettings>
