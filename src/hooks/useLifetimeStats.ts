import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { fetchAllEntries } from './useBackup'
import { extractError, useHabits } from './useHabits'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useVacationsContext } from '../contexts/VacationsContext'
import { useLogicalToday } from './useLogicalToday'
import { lifetimeStats, type LifetimeStats } from '../lib/stats'
import { vacationDatesInRange } from '../lib/vacation'
import type { Entry } from '../lib/score'

export interface UseLifetimeStatsResult {
  stats: LifetimeStats
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useLifetimeStats(): UseLifetimeStatsResult {
  // Use habits context if available, otherwise fallback to useHabits
  let habitsContext: ReturnType<typeof useHabitsContext> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    habitsContext = useHabitsContext()
  } catch {
    // Context may not be mounted in certain test or isolated environments
  }
  const fallbackHabits = useHabits()
  const habits = habitsContext ? habitsContext.habits : fallbackHabits.habits

  // Vacation periods
  let vacationsContext: ReturnType<typeof useVacationsContext> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    vacationsContext = useVacationsContext()
  } catch {
    // Context not mounted
  }
  const periods = vacationsContext ? vacationsContext.periods : []

  const today = useLogicalToday()

  const [rawEntries, setRawEntries] = useState<(Entry & { habit_id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sb = getSupabase()
      const rows = await fetchAllEntries(sb)
      const mapped: (Entry & { habit_id: string })[] = rows.map((r) => ({
        habit_id: r.habit_id as string,
        date: r.date as string,
        value: typeof r.value === 'number' ? r.value : Number(r.value) || 0,
        status: r.status === 'skipped' ? 'skipped' : 'done',
      }))
      setRawEntries(mapped)
    } catch (e) {
      setError(extractError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()

    function handleEntriesReload() {
      void reload()
    }
    window.addEventListener('entries-reload', handleEntriesReload)
    return () => window.removeEventListener('entries-reload', handleEntriesReload)
  }, [reload])

  const stats = useMemo(() => {
    // Calculate relevant vacation dates across the tracking range
    let earliest = today
    for (const h of habits) {
      const d = h.created_at.slice(0, 10)
      if (d < earliest) earliest = d
    }
    const vacationDates = vacationDatesInRange(periods, earliest, today)

    return lifetimeStats({
      habits,
      entries: rawEntries,
      today,
      vacations: vacationDates,
    })
  }, [habits, rawEntries, today, periods])

  return { stats, loading, error, reload }
}
