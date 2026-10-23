import { useCallback, useEffect, useState } from 'react'
import type { Habit } from '../lib/score'
import { getSupabase } from '../lib/supabase'
import { toLocalDateString } from '../lib/dates'

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
  let query = sb.from('habits').select('*').order('sort_order')
  if (!includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  if (error) throw error
  return (data as HabitRow[]).map(mapHabit)
}

export async function createHabit(values: HabitInput): Promise<Habit> {
  const sb = getSupabase()
  const { data: userData, error: userError } = await sb.auth.getUser()
  if (userError) throw userError
  const user = userData.user
  if (!user) throw new Error('You must be signed in to create a habit')

  const { data: last, error: lastError } = await sb
    .from('habits')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  if (lastError) throw lastError
  const nextOrder = last && last.length > 0 ? Number(last[0].sort_order) + 1 : 0

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

/** Active (or all) habits with explicit loading and error states. */
export function useHabits(options: { includeArchived?: boolean } = {}) {
  const includeArchived = options.includeArchived === true
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
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

  return { habits, loading, error, reload, archiveHabit }
}