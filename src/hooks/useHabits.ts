import { useCallback, useEffect, useState } from 'react'
import type { Habit } from '../lib/score'
import type { ScheduleConfig, ScheduleMode, ScheduleType } from '../lib/schedule'
import { getSupabase } from '../lib/supabase'
import { toLogicalDateString } from '../lib/dates'
import { diffOrder, sortHabits } from '../lib/order'
import { useSettings } from '../contexts/SettingsContext'

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
  emoji: string | null
  sort_order: number
  archived: boolean
  created_at: string
  /** Stage 3 schedule columns — absent entirely on a pre-migration DB. */
  schedule_type?: ScheduleMode | null
  scheduled_days?: number | null
  interval_days?: number | null
  weekly_target?: number | null
  /** Custom/legacy frequency columns (populated by the append_habit_schedule_epoch RPC). */
  legacy_freq_times?: number | null
  legacy_freq_days?: number | null
}

export type HabitInput = {
  name: string
  type: 'boolean' | 'numeric'
  target: number
  unit: string | null
  freq_times: number
  freq_days: number
  color: string
  emoji: string | null
  /** Stage 3 schedule columns — creation only. Omitting schedule_type keeps
   *  the pre-scheduling behavior bit-for-bit (DB default 'daily'; the §9
   *  normalize trigger reclassifies non-daily freq to 'legacy'). Edits of
   *  existing schedules must NOT write these columns directly — the §7b
   *  guard blocks it — they go through updateHabitSchedule (RPC). */
  schedule_type?: ScheduleType
  scheduled_days?: number
  interval_days?: number
  weekly_target?: number
}

export type HabitUpdate = Partial<HabitInput> & { archived?: boolean; sort_order?: number }

/** Human-readable message from an unknown thrown value. */
export function extractError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  return 'Something went wrong. Please try again.'
}

function mapHabit(row: HabitRow, dayStartHour: number): Habit {
  // created_at is a UTC timestamp; convert to the user's local LOGICAL date
  // (Asia/Kolkata shifted by the day start) — a habit created at 02:00 with a
  // 4 AM day start is eligible from the previous day.
  return {
    ...row,
    created_at: toLogicalDateString(new Date(row.created_at), dayStartHour),
    // A null schedule_type (pre-backfill window) means "no schedule data".
    schedule_type: row.schedule_type ?? undefined,
    legacy_freq_times: row.legacy_freq_times ?? undefined,
    legacy_freq_days: row.legacy_freq_days ?? undefined,
  }
}

async function fetchHabits(includeArchived: boolean, dayStartHour: number): Promise<Habit[]> {
  const sb = getSupabase()
  let query = sb.from('habits').select('*')
  if (!includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  if (error) throw error
  // sort_order (then created_at, then id) is the single source of truth —
  // the list is always passed through sortHabits, never DB order alone.
  return sortHabits((data as HabitRow[]).map((row) => mapHabit(row, dayStartHour)))
}

export async function createHabit(values: HabitInput, dayStartHour = 0): Promise<Habit> {
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
  return mapHabit(data as HabitRow, dayStartHour)
}

export async function updateHabit(
  id: string,
  values: HabitUpdate,
  dayStartHour = 0,
): Promise<Habit> {
  const sb = getSupabase()
  const { data, error } = await sb.from('habits').update(values).eq('id', id).select('*').single()
  if (error) throw error
  return mapHabit(data as HabitRow, dayStartHour)
}

/** Stage 3: change an existing habit's schedule through the approved v7 RPC
 *  (append_habit_schedule_epoch). The RPC re-checks ownership, validates the
 *  payload, syncs the freq mirror and appends/coalesces the history epoch
 *  atomically — direct UPDATEs of the schedule/frequency columns are blocked
 *  by the §7b guard once the migration is applied. Throws for the caller to
 *  display; nothing is written when it fails. */
export async function updateHabitSchedule(
  id: string,
  schedule: ScheduleConfig,
): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.rpc('append_habit_schedule_epoch', {
    p_habit_id: id,
    p_schedule_type: schedule.schedule_type,
    p_scheduled_days: schedule.scheduled_days ?? null,
    p_interval_days: schedule.interval_days ?? null,
    p_weekly_target: schedule.weekly_target ?? null,
    p_legacy_freq_times: schedule.legacy_freq_times ?? null,
    p_legacy_freq_days: schedule.legacy_freq_days ?? null,
  })
  if (error) throw error
}

/** Atomically update habit details and (optionally) its schedule in one RPC. */
export async function updateHabitAtomically(
  id: string,
  values: Pick<HabitUpdate, 'name' | 'type' | 'target' | 'unit' | 'color' | 'emoji'>,
  schedule: ScheduleConfig | null,
): Promise<void> {
  const { error } = await getSupabase().rpc('save_habit_with_schedule_v7', {
    p_habit_id: id,
    p_details: values,
    p_schedule: schedule
      ? {
          schedule_type: schedule.schedule_type,
          scheduled_days: schedule.scheduled_days ?? null,
          interval_days: schedule.interval_days ?? null,
          weekly_target: schedule.weekly_target ?? null,
          legacy_freq_times: schedule.legacy_freq_times ?? null,
          legacy_freq_days: schedule.legacy_freq_days ?? null,
        }
      : null,
  })
  if (error) throw error
}

/** Shared habit list state (all habits, archived included — views filter).
 *  Consumed through HabitsContext so every page sees the same list at once;
 *  always returned through sortHabits (sort_order → created_at → id). */
export function useHabits(options: { includeArchived?: boolean } = {}) {
  const includeArchived = options.includeArchived === true
  const { dayStartHour } = useSettings()
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    setReorderError(null)
    setLoading(true)
    try {
      setHabits(await fetchHabits(includeArchived, dayStartHour))
    } catch (e) {
      setError(extractError(e))
    } finally {
      setLoading(false)
    }
  }, [includeArchived, dayStartHour])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Optimistically flip the archived flag; roll back and re-throw on error. */
  const archiveHabit = useCallback(
    async (id: string, archived: boolean) => {
      const snapshot = habits
      setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, archived } : h)))
      try {
        await updateHabit(id, { archived }, dayStartHour)
      } catch (e) {
        setHabits(snapshot)
        throw e
      }
    },
    [habits, dayStartHour],
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
          changed.map((c) => updateHabit(c.id, { sort_order: c.sort_order }, dayStartHour)),
        )
      } catch (e) {
        setHabits(snapshot)
        setReorderError(extractError(e))
      }
    },
    [habits, dayStartHour],
  )

  return { habits, loading, error, reload, archiveHabit, reorderHabits, reorderError }
}

export type UseHabitsResult = ReturnType<typeof useHabits>
