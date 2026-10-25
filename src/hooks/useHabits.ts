import { useCallback, useEffect, useState } from 'react'
import type { Habit } from '../lib/score'
import { getSupabase } from '../lib/supabase'
import { toLocalDateString } from '../lib/dates'
import { diffOrder, sortHabits } from '../lib/order'

interface HabitRow {
  id: string
  user_id: string
  name: string
  type: 'boolean' | 'numeric'
  target: number
  unit: string | null
  freq_times: number
  freq_days: number
  color: string
  sort_order: number
  archived: boolean
  created_at: string
}

export type HabitInput = {
  name: string
  type: 'boolean' | 'numeric'
  target: number
  unit: string | null
  freq_times: number
  freq_days: number
  color: string
}

export type HabitUpdate = Partial<HabitInput> & { archived?: boolean; sort_order?: number }

/** Human-readable message from an unknown thrown value. */
export function extractError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  return 'Something went wrong. Please try again.'
}

function mapHabit(row: HabitRow): Habit {
  // created_at is a UTC timestamp; convert to the user's local date (Asia/Kolkata).
  return { ...row, created_at: toLocalDateString(new Date(row.created_at)) }
}

async function fetchHabits(includeArchived: boolean): Promise<Habit[]> {
  const sb = getSupabase()
  let query = sb.from('habits').select('*')
  if (!includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  if (error) throw error
  // sort_order (then created_at, then id) is the single source of truth —
  // the list is always passed through sortHabits, never DB order alone.
  return sortHabits((data as HabitRow[]).map(mapHabit))
}

export async function createHabit(values: HabitInput): Promise<Habit> {
  const sb = getSupabase()
  const { data: userData, error: userError } = await sb.auth.getUser()
  if (userError) throw userError
  const user = userData.user
  if (!user) throw new Error('You must be signed in to create a habit')

  // New habits go to the end of the order: sort_order = max(existing) + 1
  // (first habit ever = 1). RLS scopes the query to the user's own rows.
  const { data: last, error: lastError } = await sb
    .from('habits')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  if (lastError) throw lastError
  const nextOrder = last && last.length > 0 ? Number(last[0].sort_order) + 1 : 1

  const { data, error } = await sb
    .from('habits')
    .insert({ ...values, user_id: user.id, sort_order: nextOrder, archived: false })
    .select('*')
    .single()
  if (error) throw error
  return mapHabit(data as HabitRow)
}

export async function updateHabit(id: string, values: HabitUpdate): Promise<Habit> {
  const sb = getSupabase()
  const { data, error } = await sb.from('habits').update(values).eq('id', id).select('*').single()
  if (error) throw error
  return mapHabit(data as HabitRow)
}

/** Shared habit list state (all habits, archived included — views filter).
 *  Consumed through HabitsContext so every page sees the same list at once;
 *  always returned through sortHabits (sort_order → created_at → id). */
export function useHabits(options: { includeArchived?: boolean } = {}) {
  const includeArchived = options.includeArchived === true
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    setReorderError(null)
    setLoading(true)
    try {
      setHabits(await fetchHabits(includeArchived))
    } catch (e) {
      setError(extractError(e))
    } finally {
      setLoading(false)
    }
  }, [includeArchived])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Optimistically flip the archived flag; roll back and re-throw on error. */
  const archiveHabit = useCallback(
    async (id: string, archived: boolean) => {
      const snapshot = habits
      setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, archived } : h)))
      try {
        await updateHabit(id, { archived })
      } catch (e) {
        setHabits(snapshot)
        throw e
      }
    },
    [habits],
  )

  /** Reorder to `orderedIds` (dnd result). Applies the new order optimistically,
   *  then saves only the rows whose position changed (one update().eq() per
   *  changed row — never upsert, whose insert path would fail on the not-null
   *  columns). On any save failure the previous order is restored and the
   *  message is exposed via `reorderError` (not re-thrown). Habits not named
   *  in orderedIds (e.g. archived) keep their relative order behind the
   *  reordered block. */
  const reorderHabits = useCallback(
    async (orderedIds: string[]) => {
      if (orderedIds.length === 0) return
      setReorderError(null)
      const snapshot = habits
      const byId = new Map(habits.map((h) => [h.id, h] as const))
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((h): h is Habit => h !== undefined)
      const rest = habits.filter((h) => !orderedIds.includes(h.id))
      // Renumber by position (1..n): the block order from the drag is
      // authoritative, so re-sorting by the stale sort_order would undo it.
      const next = [...reordered, ...rest].map((h, i) =>
        h.sort_order === i + 1 ? h : { ...h, sort_order: i + 1 },
      )
      const changed = diffOrder(habits, next)
      if (changed.length === 0) return
      setHabits(next)
      try {
        await Promise.all(
          changed.map((c) => updateHabit(c.id, { sort_order: c.sort_order })),
        )
      } catch (e) {
        setHabits(snapshot)
        setReorderError(extractError(e))
      }
    },
    [habits],
  )

  return { habits, loading, error, reload, archiveHabit, reorderHabits, reorderError }
}

export type UseHabitsResult = ReturnType<typeof useHabits>
