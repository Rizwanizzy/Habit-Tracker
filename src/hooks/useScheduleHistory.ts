import { useEffect, useState } from 'react'
import { sortEpochs, type ScheduleEpoch } from '../lib/schedule'
import { getSupabase } from '../lib/supabase'
import { scheduleColumnsAvailable } from '../lib/scheduleSupport'
import { extractError } from './useHabits'

export type EpochsByHabit = Record<string, ScheduleEpoch[]>

interface EpochRow {
  id: string
  habit_id: string
  effective_from: string
  schedule_type: string
  scheduled_days: number | null
  interval_days: number | null
  weekly_target: number | null
  legacy_freq_times: number | null
  legacy_freq_days: number | null
}

/** One epoch list per habit, grouped and sorted by effective_from (append
 *  order matters for same-day final-wins resolution). */
function groupByHabit(rows: EpochRow[]): EpochsByHabit {
  const map: EpochsByHabit = {}
  for (const row of rows) {
    const list = map[row.habit_id] ?? []
    list.push({
      id: row.id,
      effective_from: row.effective_from,
      schedule_type: row.schedule_type as ScheduleEpoch['schedule_type'],
      scheduled_days: row.scheduled_days,
      interval_days: row.interval_days,
      weekly_target: row.weekly_target,
      legacy_freq_times: row.legacy_freq_times,
      legacy_freq_days: row.legacy_freq_days,
    })
    map[row.habit_id] = list
  }
  for (const id of Object.keys(map)) map[id] = sortEpochs(map[id] ?? [])
  return map
}

/**
 * Schedule history (habit_schedule_history) for the signed-in user, grouped
 * per habit. RLS scopes the SELECT to the user's own rows and the table is
 * SELECT-only — epochs are written exclusively by the append RPC. On a
 * pre-migration database the capability probe short-circuits to an empty
 * map: no epochs means "no schedule context" → exact pre-scheduling
 * behaviour for every consumer. Errors are exposed, never swallowed.
 */
export function useScheduleHistory(): {
  epochsByHabit: EpochsByHabit
  loading: boolean
  error: string | null
} {
  const [epochsByHabit, setEpochsByHabit] = useState<EpochsByHabit>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // An epoch change anywhere in the app (habit form RPC save) dispatches
  // `schedule-reload` so mounted hooks refetch immediately.
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    const onReload = () => setReloadTick((t) => t + 1)
    window.addEventListener('schedule-reload', onReload)
    return () => window.removeEventListener('schedule-reload', onReload)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        // The probe is cached per session: false = migration not applied.
        if (!(await scheduleColumnsAvailable())) {
          if (active) {
            setEpochsByHabit({})
            setLoading(false)
          }
          return
        }
        const { data, error } = await getSupabase()
          .from('habit_schedule_history')
          .select(
            'id, habit_id, effective_from, schedule_type, scheduled_days, interval_days, weekly_target, legacy_freq_times, legacy_freq_days',
          )
          .order('effective_from')
        if (error) throw error
        if (active) setEpochsByHabit(groupByHabit((data ?? []) as EpochRow[]))
      } catch (e) {
        if (active) setError(extractError(e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [reloadTick])

  return { epochsByHabit, loading, error }
}
