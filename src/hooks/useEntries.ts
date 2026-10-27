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
}

function groupByHabit(rows: EntryRow[]): EntriesByHabit {
  const map: EntriesByHabit = {}
  for (const row of rows) {
    const list = map[row.habit_id] ?? []
    list.push({ date: row.date, value: Number(row.value) })
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
        const { data, error } = await sb
          .from('entries')
          .select('habit_id, date, value')
          .in('habit_id', ids)
          .gte('date', since)
          .order('date')
        if (error) throw error
        if (active) setEntriesByHabit(groupByHabit(data as EntryRow[]))
      } catch (e) {
        if (active) setError(extractError(e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [idsKey, sinceDays, dayStartHour])

  async function saveEntry(habitId: string, date: string, value: number) {
    const sb = getSupabase()
    const { data: userData, error: userError } = await sb.auth.getUser()
    if (userError) throw userError
    if (!userData.user) throw new Error('You must be signed in')
    const payload = { user_id: userData.user.id, habit_id: habitId, date, value }
    const { error } = await sb.from('entries').upsert(payload, { onConflict: 'habit_id,date' })
    if (error) throw error
  }

  async function removeEntry(habitId: string, date: string) {
    const sb = getSupabase()
    const { error } = await sb.from('entries').delete().eq('habit_id', habitId).eq('date', date)
    if (error) throw error
  }

  return { entriesByHabit, loading, error, saveEntry, removeEntry, setEntriesByHabit }
}