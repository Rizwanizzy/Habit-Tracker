import { dayStatus, isEntryDone, isNeutral, type DayStatus } from './dayStatus'

export const SMOOTHING_CONSTANT = 0.05

export type Habit = {
  id: string
  user_id?: string
  name?: string
  type: 'boolean' | 'numeric'
  target: number
  unit?: string | null
  freq_times: number
  freq_days: number
  color?: string
  sort_order?: number
  archived?: boolean
  /** Local YYYY-MM-DD date the habit counts from. */
  created_at: string
}

export type EntryStatus = 'done' | 'skipped'

export type Entry = { date: string; value: number; status?: EntryStatus }

/** True only for status 'done' (numeric: value >= target). A skipped row is
 *  never done. Implemented in dayStatus.ts (entryDone predicate shared with
 *  the day classifier). */
export function isDone(habit: Habit, entry: Entry | undefined): boolean {
  return isEntryDone(habit, entry)
}

export function perDayWeight(habit: Habit): number {
  const freqPerDay = habit.freq_times / Math.max(1, habit.freq_days)
  return 1 - Math.pow(1 - SMOOTHING_CONSTANT, freqPerDay)
}

function addDaysStr(s: string, n: number): string {
  const [y, m, dd] = s.split('-').map(Number)
  const date = new Date(y, m - 1, dd)
  date.setDate(date.getDate() + n)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${day}`
}

/** Classify one day inside a stats loop. Neutral days (skipped/vacation)
 *  and days before the habit's start are removed from the timeline. */
function classify(
  habit: Habit,
  byDate: Map<string, Entry>,
  date: string,
  today: string,
  vacations: readonly string[],
): DayStatus {
  return dayStatus({ habit, date, entry: byDate.get(date), today, vacations })
}

export function scoreRange(
  habit: Habit,
  entries: Entry[],
  startDate: string,
  endDate: string,
  vacations: readonly string[] = [],
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const weight = perDayWeight(habit)
  let score = 0
  // Never count days before the habit started.
  let d = habit.created_at > startDate ? habit.created_at : startDate
  while (d <= endDate) {
    const status = classify(habit, byDate, d, endDate, vacations)
    // Neutral days carry the score over unchanged (no EMA step).
    if (isNeutral(status)) {
      d = addDaysStr(d, 1)
      continue
    }
    score = score + (status === 'done' ? 1 - score : 0 - score) * weight
    d = addDaysStr(d, 1)
  }
  return score
}

export function currentStreak(
  habit: Habit,
  entries: Entry[],
  asOf: string,
  vacations: readonly string[] = [],
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  let streak = 0
  let d = asOf
  while (d >= habit.created_at) {
    const status = classify(habit, byDate, d, asOf, vacations)
    if (status === 'done') {
      streak++
    } else if (!isNeutral(status)) {
      break // a missed day ends the streak
    }
    // Neutral days neither count nor break — keep walking back.
    d = addDaysStr(d, -1)
  }
  return streak
}

export function bestStreak(
  habit: Habit,
  entries: Entry[],
  vacations: readonly string[] = [],
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  let best = 0
  let cur = 0
  // iterate from created_at to max entry date
  const dates = entries.map((e) => e.date).sort()
  if (dates.length === 0) return 0
  const start = habit.created_at
  const end = dates[dates.length - 1]
  let d = start
  while (d <= end) {
    const status = classify(habit, byDate, d, end, vacations)
    if (status === 'done') {
      cur++
      if (cur > best) best = cur
    } else if (!isNeutral(status)) {
      cur = 0
    }
    d = addDaysStr(d, 1)
  }
  return best
}

export function completionRate(
  habit: Habit,
  entries: Entry[],
  startDate: string,
  endDate: string,
  vacations: readonly string[] = [],
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const start = habit.created_at > startDate ? habit.created_at : startDate
  let total = 0
  let done = 0
  let d = start
  while (d <= endDate) {
    const status = classify(habit, byDate, d, endDate, vacations)
    // Neutral days are excluded from the denominator: zero eligible days
    // keeps the rate at 0 (never NaN).
    if (!isNeutral(status)) {
      total++
      if (status === 'done') done++
    }
    d = addDaysStr(d, 1)
  }
  if (total === 0) return 0
  return done / total
}

export type ScorePoint = { date: string; score: number }

/** Daily EMA values for charting; final point equals scoreRange over the same window. */
export function scoreSeries(
  habit: Habit,
  entries: Entry[],
  startDate: string,
  endDate: string,
  vacations: readonly string[] = [],
): ScorePoint[] {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const weight = perDayWeight(habit)
  let score = 0
  const points: ScorePoint[] = []
  let d = habit.created_at > startDate ? habit.created_at : startDate
  while (d <= endDate) {
    const status = classify(habit, byDate, d, endDate, vacations)
    // Neutral days carry the score over unchanged, but the chart still gets
    // a point so the line stays continuous.
    if (!isNeutral(status)) {
      score = score + (status === 'done' ? 1 - score : 0 - score) * weight
    }
    points.push({ date: d, score })
    d = addDaysStr(d, 1)
  }
  return points
}
