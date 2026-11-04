import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { newId } from '../lib/id'
import { addDays, logicalToday } from '../lib/dates'
import { isVacationDay, sortPeriods, type VacationPeriod } from '../lib/vacation'
import { now } from '../lib/clock'
import { useSettings } from '../contexts/SettingsContext'

type Params = {
  /** Persists to vacation_periods: start_date, end_date (null = ongoing). */
  start_date: string
  end_date: string | null
}

/** The vacation_periods table as a hook: load on mount, plus optimistic
 *  start/end/remove with snapshot rollback. Errors are EXPOSED via `error`
 *  (string), never thrown — the UI shows them next to the controls. */
export function useVacations() {
  const { dayStartHour } = useSettings()
  const [periods, setPeriods] = useState<VacationPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const sb = getSupabase()
      const { data, error: dbError } = await sb
        .from('vacation_periods')
        .select('*')
        .order('start_date')
      if (cancelled) return
      if (dbError) {
        setError(dbError.message)
      } else {
        setPeriods(sortPeriods((data ?? []) as VacationPeriod[]))
        setError(null)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  /** The current logical date (YYYY-MM-DD), day-start aware. */
  const today = logicalToday(now(), dayStartHour)

  const startVacation = useCallback(
    async ({ start_date, end_date }: Params): Promise<boolean> => {
      const sb = getSupabase()
      const {
        data: userData,
        error: userError,
      } = await sb.auth.getUser()
      if (userError || !userData.user) {
        setError('You must be signed in to schedule a break')
        return false
      }
      const user = userData.user
      // Optimistic: temp id until the row comes back; snapshot for rollback.
      const snapshot = periods
      const temp: VacationPeriod = {
        id: newId(),
        start_date,
        end_date,
        created_at: now().toISOString(),
      }
      setPeriods((prev) => sortPeriods([...prev, temp]))
      const { data, error: dbError } = await sb
        .from('vacation_periods')
        .insert({ user_id: user.id, start_date, end_date })
        .select('*')
        .single()
      if (dbError) {
        setPeriods(snapshot)
        setError(dbError.message)
        return false
      }
      setPeriods((prev) => sortPeriods([...prev.filter((p) => p.id !== temp.id), data as VacationPeriod]))
      setError(null)
      return true
    },
    [periods],
  )

  /** End a break: end_date becomes the logical YESTERDAY; if that is before
   *  the start date the still-empty period is deleted entirely. */
  const endVacation = useCallback(
    async (id: string): Promise<boolean> => {
      const sb = getSupabase()
      const snapshot = periods
      const period = periods.find((p) => p.id === id)
      const yesterday = addDays(today, -1)
      const deletes = period !== undefined && yesterday < period.start_date
      setPeriods((prev) =>
        deletes
          ? prev.filter((p) => p.id !== id)
          : prev.map((p) => (p.id === id ? { ...p, end_date: yesterday } : p)),
      )
      const { error: dbError } = deletes
        ? await sb.from('vacation_periods').delete().eq('id', id)
        : await sb.from('vacation_periods').update({ end_date: yesterday }).eq('id', id)
      if (dbError) {
        setPeriods(snapshot)
        setError(dbError.message)
        return false
      }
      if (!deletes && period !== undefined && yesterday < period.start_date) {
        // Race guard: a stale client view — fall back to deleting server-side.
        await sb.from('vacation_periods').delete().eq('id', id)
        setPeriods((prev) => prev.filter((p) => p.id !== id))
      }
      setError(null)
      return true
    },
    [periods, today],
  )

  const removeVacation = useCallback(
    async (id: string): Promise<boolean> => {
      const sb = getSupabase()
      const snapshot = periods
      setPeriods((prev) => prev.filter((p) => p.id !== id))
      const { error: dbError } = await sb.from('vacation_periods').delete().eq('id', id)
      if (dbError) {
        setPeriods(snapshot)
        setError(dbError.message)
        return false
      }
      setError(null)
      return true
    },
    [periods],
  )

  return {
    periods,
    /** True when the logical today falls inside any period. */
    onVacation: isVacationDay(today, periods),
    today,
    loading,
    error,
    startVacation,
    endVacation,
    removeVacation,
  }
}

export type UseVacationsResult = ReturnType<typeof useVacations>
