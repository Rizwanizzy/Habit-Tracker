import { useEffect, useRef, useState } from 'react'
import type { Entry } from '../lib/score'
import { getSupabase } from '../lib/supabase'
import { addDays, logicalToday } from '../lib/dates'
import { now } from '../lib/clock'
import { useSettings } from '../contexts/SettingsContext'
import { extractError } from './useHabits'

export type EntriesByHabit = Record<string, Entry[]>

interface EntryRow {
  habit_id: string
  date: string
  value: number
  status?: string
}

function groupByHabit(rows: EntryRow[]): EntriesByHabit {
  const map: EntriesByHabit = {}
  for (const row of rows) {
    const list = map[row.habit_id] ?? []
    list.push({ date: row.date, value: Number(row.value), status: row.status === 'skipped' ? 'skipped' : 'done' })
    map[row.habit_id] = list
  }
  return map
}

/**
 * Entries for the given habits from `sinceDays` back, grouped per habit.
 * saveEntry/removeEntry hit Supabase; callers apply optimistic UI and roll back on failure.
 */
export function useEntries(habitIds: string[], sinceDays = 365) {
  const [entriesByHabit, setEntriesByHabit] = useState<EntriesByHabit>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The window ends at the logical today (day-start aware).
  const { dayStartHour } = useSettings()

  const idsRef = useRef(habitIds)
  idsRef.current = habitIds
  const idsKey = habitIds.slice().sort().join('|')
  // An import finishing anywhere in the app dispatches `entries-reload`
  // (window event) so every mounted useEntries hook refetches immediately.
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    const onReload = () => setReloadTick((t) => t + 1)
    window.addEventListener('entries-reload', onReload)
    return () => window.removeEventListener('entries-reload', onReload)
  }, [])

  useEffect(() => {
    const ids = idsRef.current
    if (ids.length === 0) {
      setEntriesByHabit({})
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const sb = getSupabase()
        const since = addDays(logicalToday(now(), dayStartHour), -sinceDays)
        const allRows: EntryRow[] = []
        let from = 0
        const PAGE_SIZE = 1000
        while (true) {
          const { data, error } = await sb
            .from('entries')
            .select('habit_id, date, value, status')
            .in('habit_id', ids)
            .gte('date', since)
            .order('date')
            .range(from, from + PAGE_SIZE - 1)
          if (error) throw error
          if (data && data.length > 0) {
            allRows.push(...(data as EntryRow[]))
          }
          if (!data || data.length < PAGE_SIZE) break
          from += PAGE_SIZE
        }
        if (active) setEntriesByHabit(groupByHabit(allRows))
      } catch (e) {
        if (active) setError(extractError(e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [idsKey, sinceDays, dayStartHour, reloadTick])

  async function saveEntry(habitId: string, date: string, value: number) {
    const sb = getSupabase()
    const { data: userData, error: userError } = await sb.auth.getUser()
    if (userError) throw userError
    if (!userData.user) throw new Error('You must be signed in')
    // status is always explicit: a check-in on a skipped day upserts 'done'.
    const payload = { user_id: userData.user.id, habit_id: habitId, date, value, status: 'done' }
    const { error } = await sb.from('entries').upsert(payload, { onConflict: 'habit_id,date' })
    if (error) throw error
  }

  /** Mark a day skipped (neutral): the row stores value 0 (NOT NULL column),
   *  status 'skipped'. Only valid when no done entry exists — callers
   *  remove the row to undo (removeEntry). */
  async function skipEntry(habitId: string, date: string) {
    const sb = getSupabase()
    const { data: userData, error: userError } = await sb.auth.getUser()
    if (userError) throw userError
    if (!userData.user) throw new Error('You must be signed in')
    const payload = { user_id: userData.user.id, habit_id: habitId, date, value: 0, status: 'skipped' }
    const { error } = await sb.from('entries').upsert(payload, { onConflict: 'habit_id,date' })
    if (error) throw error
  }

  async function removeEntry(habitId: string, date: string) {
    const sb = getSupabase()
    const { error } = await sb.from('entries').delete().eq('habit_id', habitId).eq('date', date)
    if (error) throw error
  }

  return { entriesByHabit, loading, error, saveEntry, skipEntry, removeEntry, setEntriesByHabit }
}