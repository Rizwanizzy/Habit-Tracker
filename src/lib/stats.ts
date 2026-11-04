import { bestStreak, isDone, type Entry, type Habit } from './score'
import { dayStatus } from './dayStatus'
import { addDays, daysBetween } from './dates'

export interface LongestStreak {
  days: number
  habitId: string | null
}

export interface LifetimeStats {
  longestStreak: LongestStreak
  totalCheckIns: number
  consistency30: number | null
  daysTracking: number
  activeHabits: number
  archivedHabits: number
}

export interface LifetimeStatsInput {
  habits: Habit[]
  entries: (Entry & { habit_id: string })[]
  /** Caller's logical today (YYYY-MM-DD). */
  today: string
  /** Concrete vacation dates (YYYY-MM-DD) within the relevant window. */
  vacations?: readonly string[]
}

/** Pure lifetime statistics calculation across all habits and full entry history. */
export function lifetimeStats({
  habits,
  entries,
  today,
  vacations = [],
}: LifetimeStatsInput): LifetimeStats {
  // 1. Group entries by habit_id
  const entriesByHabit = new Map<string, (Entry & { habit_id: string })[]>()
  const habitMap = new Map<string, Habit>()

  for (const h of habits) {
    habitMap.set(h.id, h)
  }

  for (const e of entries) {
    let list = entriesByHabit.get(e.habit_id)
    if (!list) {
      list = []
      entriesByHabit.set(e.habit_id, list)
    }
    list.push(e)
  }

  // 2. Longest streak: max of bestStreak over ALL habits (including archived)
  let maxStreakDays = 0
  let bestHabitId: string | null = habits.length > 0 ? habits[0].id : null

  for (const habit of habits) {
    const habitEntries = entriesByHabit.get(habit.id) ?? []
    const streak = bestStreak(habit, habitEntries, vacations)
    if (streak > maxStreakDays) {
      maxStreakDays = streak
      bestHabitId = habit.id
    }
  }

  const longestStreak: LongestStreak = {
    days: maxStreakDays,
    habitId: habits.length > 0 ? bestHabitId : null,
  }

  // 3. Total check-ins: habit-days that count as done via isDone across all habits
  let totalCheckIns = 0
  const countedHabitDays = new Set<string>()

  for (const e of entries) {
    const key = `${e.habit_id}:${e.date}`
    if (countedHabitDays.has(key)) continue
    const habit = habitMap.get(e.habit_id)
    if (habit && isDone(habit, e)) {
      countedHabitDays.add(key)
      totalCheckIns++
    }
  }

  // 4. 30-day consistency: last 30 logical days for ACTIVE habits
  // Window: [today - 29 days, today] (30 calendar days inclusive)
  const activeHabits = habits.filter((h) => !h.archived)
  let eligibleHabitDays = 0
  let doneHabitDays = 0

  const entryByKey = new Map<string, Entry>()
  for (const e of entries) {
    entryByKey.set(`${e.habit_id}:${e.date}`, e)
  }

  for (let offset = 29; offset >= 0; offset--) {
    const date = addDays(today, -offset)
    for (const habit of activeHabits) {
      const entry = entryByKey.get(`${habit.id}:${date}`)
      const status = dayStatus({ habit, date, entry, today, vacations })
      if (status === 'done') {
        eligibleHabitDays++
        doneHabitDays++
      } else if (status === 'missed') {
        eligibleHabitDays++
      }
      // 'before-start', 'future', 'skipped', and 'vacation' are neutral/ineligible
    }
  }

  const consistency30 =
    eligibleHabitDays > 0 ? Math.round((doneHabitDays / eligibleHabitDays) * 100) : null

  // 5. Days tracking: days from earliest habit created_at through today, inclusive
  let daysTracking = 0
  if (habits.length > 0) {
    let earliest = habits[0].created_at.slice(0, 10)
    for (let i = 1; i < habits.length; i++) {
      const d = habits[i].created_at.slice(0, 10)
      if (d < earliest) earliest = d
    }
    const diff = daysBetween(earliest, today)
    daysTracking = diff >= 0 ? diff + 1 : 1
  }

  // 6. Habit counts
  const activeHabitsCount = activeHabits.length
  const archivedHabitsCount = habits.filter((h) => Boolean(h.archived)).length

  return {
    longestStreak,
    totalCheckIns,
    consistency30,
    daysTracking,
    activeHabits: activeHabitsCount,
    archivedHabits: archivedHabitsCount,
  }
}
