import { dayStatus, isEntryDone, isNeutral, type DayStatus } from './dayStatus'
import { isTransitionWeek, resolveEpoch, weekEnd, weekStart, type ScheduleEpoch } from './schedule'

export const SMOOTHING_CONSTANT = 0.05

/** The EMA step for `k` scheduled opportunities in the approved `1 − 0.95^k`
 *  family: one per scheduled opportunity for daily/weekdays/interval modes
 *  (k = 1) and one per completed week for weekly-target mode (k = M). Equals
 *  perDayWeight of a 1/1 daily habit bit-exactly, so daily scoring is
 *  identical whether or not schedule epochs are supplied. */
function alphaFor(k: number): number {
  return 1 - Math.pow(1 - SMOOTHING_CONSTANT, k)
}

/** One scheduled opportunity of a daily/weekdays/interval schedule. */
const OPPORTUNITY_ALPHA = alphaFor(1)

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
  /** Optional single emoji shown inside the tile's check ring. */
  emoji?: string | null
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
  return alphaFor(freqPerDay)
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
  epochs?: readonly ScheduleEpoch[],
): number {
  if (epochs !== undefined && epochs.length > 0) {
    const points = scheduledScoreSeries(habit, entries, startDate, endDate, vacations, epochs)
    return points.length > 0 ? points[points.length - 1].score : 0
  }
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
  epochs?: readonly ScheduleEpoch[],
): ScorePoint[] {
  if (epochs !== undefined && epochs.length > 0) {
    return scheduledScoreSeries(habit, entries, startDate, endDate, vacations, epochs)
  }
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

// --- Stage 2 scoring law (schedule epochs supplied) --------------------------
// daily/weekdays/interval → one step per scheduled opportunity (alpha
// 1 − 0.95^1; unscheduled days carry). weekly_target → one step per CLOSED
// Monday–Sunday week (alpha 1 − 0.95^M, achieved = done entries ≥ M; current,
// incomplete and transition weeks carry). legacy → the frozen-snapshot daily
// formula 1 − 0.95^(M/N) over every day, exactly like the pre-scheduling walk.

/** EMA step size for one opportunity of the epoch's mode: the frozen legacy
 *  snapshot formula for legacy epochs, the base opportunity step otherwise. */
function epochAlpha(habit: Habit, epoch: ScheduleEpoch): number {
  if (epoch.schedule_type === 'legacy') {
    const times = epoch.legacy_freq_times ?? habit.freq_times
    const days = epoch.legacy_freq_days ?? habit.freq_days
    return alphaFor(times / Math.max(1, days))
  }
  return OPPORTUNITY_ALPHA
}

/** Was a weekly-target week achieved? Done entries count (including on
 *  vacation days — done wins); skipped rows are never done. */
function weeklyTargetAchieved(
  habit: Habit,
  byDate: Map<string, Entry>,
  firstDay: string,
  lastDay: string,
  target: number,
): boolean {
  let done = 0
  let d = firstDay
  while (d <= lastDay) {
    if (isEntryDone(habit, byDate.get(d))) done++
    d = addDaysStr(d, 1)
  }
  return done >= target
}

function scheduledScoreSeries(
  habit: Habit,
  entries: Entry[],
  startDate: string,
  endDate: string,
  vacations: readonly string[],
  epochs: readonly ScheduleEpoch[],
): ScorePoint[] {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  let score = 0
  const points: ScorePoint[] = []
  /** Flat (or post-step) points from `from` up to `to`, clamped to endDate. */
  const pushThrough = (from: string, to: string) => {
    for (let p = from; p <= to && p <= endDate; p = addDaysStr(p, 1)) {
      points.push({ date: p, score })
    }
  }
  let d = habit.created_at > startDate ? habit.created_at : startDate
  while (d <= endDate) {
    const epoch = resolveEpoch(epochs, d)
    if (epoch === undefined) {
      // No epoch governs this date (before the first epoch) — never eligible.
      points.push({ date: d, score })
      d = addDaysStr(d, 1)
      continue
    }
    if (epoch.schedule_type === 'weekly_target') {
      const ws = weekStart(d)
      const we = weekEnd(d)
      // Transition week (epoch effective Tue–Sun inside it) or a partial week
      // at the window edge: no weekly step — carry through to next Monday.
      // Earlier days of a transition week were already walked under their
      // governing epochs on earlier iterations.
      if (isTransitionWeek(epochs, d) || ws < d) {
        pushThrough(d, we)
        d = addDaysStr(we, 1)
        continue
      }
      if (we < endDate) {
        // Closed week (the week containing endDate is the current week and
        // is never scored).
        const target = epoch.weekly_target ?? 0
        const achieved = weeklyTargetAchieved(habit, byDate, ws, we, target)
        score = score + (achieved ? 1 - score : 0 - score) * alphaFor(target)
      }
      pushThrough(d, we)
      d = addDaysStr(we, 1)
      continue
    }
    // daily / weekdays / interval / legacy: day granularity. dayStatus with
    // the same epochs marks masked-off / off-anchor days 'unscheduled'
    // (neutral); a done entry on such a day still wins and steps.
    const status = dayStatus({
      habit,
      date: d,
      entry: byDate.get(d),
      today: endDate,
      vacations,
      schedule: epochs,
    })
    if (!isNeutral(status)) {
      score = score + (status === 'done' ? 1 - score : 0 - score) * epochAlpha(habit, epoch)
    }
    points.push({ date: d, score })
    d = addDaysStr(d, 1)
  }
  return points
}
