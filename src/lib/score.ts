import { dayStatus, isEntryDone, isNeutral, type DayStatus } from './dayStatus'
export { isEntryDone } from './dayStatus'
import {
  isTransitionWeek,
  isValidWeeklyTarget,
  resolveEpoch,
  weekEnd,
  weekStart,
  type ScheduleEpoch,
  type ScheduleMode,
} from './schedule'

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
  /** Stage 3 schedule columns (present once the v7 migration is applied;
   *  'legacy' = a frozen pre-scheduling freq). Type-only addition — all
   *  scoring reads them via the epoch history, never from the habit row. */
  schedule_type?: ScheduleMode
  scheduled_days?: number | null
  interval_days?: number | null
  weekly_target?: number | null
  /** Custom/legacy frequency (populated by the append_habit_schedule_epoch RPC). */
  legacy_freq_times?: number | null
  legacy_freq_days?: number | null
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
  epochs?: readonly ScheduleEpoch[],
): number {
  if (epochs !== undefined && epochs.length > 0) {
    return scheduledCurrentStreak(habit, entries, asOf, vacations, epochs)
  }
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
  epochs?: readonly ScheduleEpoch[],
): number {
  if (epochs !== undefined && epochs.length > 0) {
    return scheduledBestStreak(habit, entries, vacations, epochs)
  }
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

// --- Stage 4A scheduled streaks (epochs supplied) ------------------------------
// Day-granularity for daily/weekdays/interval/legacy epochs (dayStatus marks
// off-days 'unscheduled' → neutral, so they neither count nor break) and
// WEEK granularity for weekly_target: a full Monday–Sunday week governed by
// a weekly epoch counts as one unit when its done entries reach M (done wins
// on vacation days; skipped rows never count). The schedule active on a
// week's Monday governs that whole week — the ratified Stage 2 rule — so
// later completions after a mid-week switch still count toward the original
// weekly target. An open (unclosed) week that has not yet reached M is
// pending — it neither counts nor breaks, because a week that has not ended
// has decided nothing (an open week that already reached M counts — done
// wins). Transition weeks (epoch effective Tue–Sun) are neutral, matching
// the Stage 2 scoring law's weekly handling.

function scheduledCurrentStreak(
  habit: Habit,
  entries: Entry[],
  asOf: string,
  vacations: readonly string[],
  epochs: readonly ScheduleEpoch[],
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  let streak = 0
  let d = asOf
  while (d >= habit.created_at) {
    // The schedule active on the week's Monday governs the whole week.
    const ws = weekStart(d)
    const weekEpoch = resolveEpoch(epochs, ws)
    if (
      weekEpoch !== undefined &&
      weekEpoch.schedule_type === 'weekly_target' &&
      !isTransitionWeek(epochs, ws) &&
      ws >= habit.created_at
    ) {
      const we = weekEnd(d)
      if (weeklyTargetAchieved(habit, byDate, ws, we, weekEpoch.weekly_target ?? 0)) {
        streak++
      } else if (we > asOf) {
        // Open week, not yet achieved: pending, not a failure — keep the
        // streak from the closed weeks behind it.
      } else {
        break // a closed, unachieved week ends the streak
      }
      d = addDaysStr(ws, -1) // the week is decided once; jump past it
      continue
    }
    const status = dayStatus({
      habit,
      date: d,
      entry: byDate.get(d),
      today: asOf,
      vacations,
      schedule: epochs,
    })
    if (status === 'done') {
      streak++
    } else if (!isNeutral(status)) {
      break
    }
    d = addDaysStr(d, -1)
  }
  return streak
}

function scheduledBestStreak(
  habit: Habit,
  entries: Entry[],
  vacations: readonly string[],
  epochs: readonly ScheduleEpoch[],
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const dates = entries.map((e) => e.date).sort()
  if (dates.length === 0) return 0
  const end = dates[dates.length - 1]
  let best = 0
  let cur = 0
  let d = habit.created_at
  while (d <= end) {
    // The schedule active on the week's Monday governs the whole week.
    const ws = weekStart(d)
    const weekEpoch = resolveEpoch(epochs, ws)
    if (
      weekEpoch !== undefined &&
      weekEpoch.schedule_type === 'weekly_target' &&
      !isTransitionWeek(epochs, ws) &&
      ws >= habit.created_at
    ) {
      const we = weekEnd(d)
      if (weeklyTargetAchieved(habit, byDate, ws, we, weekEpoch.weekly_target ?? 0)) {
        cur++
        if (cur > best) best = cur
      } else if (we <= end) {
        cur = 0 // a closed, unachieved week resets the run
      }
      // An open week not yet achieved is pending — it carries, because more
      // days of that week can still reach M.
      d = addDaysStr(we, 1)
      continue
    }
    const status = dayStatus({
      habit,
      date: d,
      entry: byDate.get(d),
      today: end,
      vacations,
      schedule: epochs,
    })
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

/** Weekly-target progress for the week containing `date` (Monday–Sunday):
 *  done entries in the week (done wins on vacation days; skipped rows never
 *  count) against the habit's governing epoch target, or the habit row's
 *  schedule columns when no epochs are supplied (pre-migration rows have no
 *  history to read). Returns null when the habit is not on a weekly target
 *  for that week (no weekly epoch governs it and the row says otherwise). */
export function weeklyTargetProgress(
  habit: Habit,
  entries: Entry[],
  date: string,
  epochs?: readonly ScheduleEpoch[],
): { done: number; target: number } | null {
  const epoch = epochs !== undefined && epochs.length > 0 ? resolveEpoch(epochs, date) : undefined
  if (epoch !== undefined && epoch.schedule_type !== 'weekly_target') return null
  if (epoch === undefined && habit.schedule_type !== 'weekly_target') return null
  const target = epoch !== undefined ? (epoch.weekly_target ?? 0) : (habit.weekly_target ?? 0)
  if (!isValidWeeklyTarget(target)) return null
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const firstDay = weekStart(date)
  const lastDay = weekEnd(date)
  let done = 0
  let d = firstDay
  while (d <= lastDay) {
    if (isEntryDone(habit, byDate.get(d))) done++
    d = addDaysStr(d, 1)
  }
  return { done, target }
}

export function completionRate(
  habit: Habit,
  entries: Entry[],
  startDate: string,
  endDate: string,
  vacations: readonly string[] = [],
  epochs?: readonly ScheduleEpoch[],
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))

  // Weekly-target habits count eligible closed Monday–Sunday weeks, not
  // calendar days. The governing epoch is resolved at endDate to decide the
  // current mode; each week's own epoch is resolved to honour schedule
  // changes and transition weeks inside the window.
  const governingEpoch =
    epochs !== undefined && epochs.length > 0 ? resolveEpoch(epochs, endDate) : undefined
  const isWeeklyTarget =
    governingEpoch !== undefined &&
    governingEpoch.schedule_type === 'weekly_target' &&
    isValidWeeklyTarget(governingEpoch.weekly_target ?? 0)

  if (isWeeklyTarget) {
    // isWeeklyTarget is true only when epochs is defined and non-empty.
    const ep = epochs!
    const target = governingEpoch.weekly_target ?? 0
    const start = habit.created_at > startDate ? habit.created_at : startDate
    let total = 0
    let done = 0
    let d = start
    while (d <= endDate) {
      // A weekly_target epoch starting Tue–Sun inside this week makes the
      // whole week neutral (transition), regardless of which epoch governs
      // day `d` itself.
      if (isTransitionWeek(ep, d)) {
        d = addDaysStr(weekEnd(d), 1)
        continue
      }
      const epoch = resolveEpoch(ep, d)
      if (epoch !== undefined && epoch.schedule_type === 'weekly_target') {
        if (!isValidWeeklyTarget(epoch.weekly_target ?? 0)) {
          // Invalid target — fall through to day-level below.
        } else {
          // Count the whole Monday–Sunday week as one opportunity.
          const ws = weekStart(d)
          const we = weekEnd(d)
          if (ws < habit.created_at) {
            // Week starts before the habit existed — carry to next Monday.
            d = addDaysStr(we, 1)
            continue
          }
          if (we > endDate) {
            // Current / incomplete week — pending, not eligible (never a failure).
            break
          }
          total++
          if (weeklyTargetAchieved(habit, byDate, ws, we, target)) done++
          d = addDaysStr(we, 1)
          continue
        }
      }
      // Non-weekly epoch (or no epoch / daily / weekdays / interval / legacy):
      // count the day at day granularity.
      const status = dayStatus({
        habit,
        date: d,
        entry: byDate.get(d),
        today: endDate,
        vacations,
        schedule: epochs,
      })
      if (!isNeutral(status)) {
        total++
        if (status === 'done') done++
      }
      d = addDaysStr(d, 1)
    }
    if (total === 0) return 0
    return done / total
  }

  // Day-based schedules: count eligible scheduled opportunities.
  const start = habit.created_at > startDate ? habit.created_at : startDate
  let total = 0
  let done = 0
  let d = start
  while (d <= endDate) {
    const status = dayStatus({
      habit,
      date: d,
      entry: byDate.get(d),
      today: endDate,
      vacations,
      schedule: epochs,
    })
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
// incomplete and transition weeks carry). legacy/custom → the frozen-snapshot
// daily formula 1 − 0.95^(X/Y) over every day, exactly like the pre-scheduling
// walk for an equivalent frequency.

/** A valid Custom frequency snapshot: whole X/Y with X ≤ Y and Y ≤ 31,
 *  matching the Custom form/DB law. */
function validCustomFrequency(
  times: number | null | undefined,
  days: number | null | undefined,
): { times: number; days: number } | null {
  if (typeof times !== 'number' || typeof days !== 'number') return null
  if (!Number.isInteger(times) || !Number.isInteger(days)) return null
  if (times < 1 || days < 1 || times > days || days > 31) return null
  return { times, days }
}

/** EMA step size for one opportunity of the epoch's mode: the frozen snapshot
 *  formula for legacy/custom epochs, the base opportunity step otherwise.
 *  A missing or corrupt Custom snapshot falls back to the base opportunity
 *  step rather than a zero, negative or oversized alpha; it deliberately does
 *  not borrow the habit's current mirror, which may describe a later schedule
 *  than the historical date being scored. */
function epochAlpha(habit: Habit, epoch: ScheduleEpoch): number {
  if (epoch.schedule_type === 'legacy') {
    const times = epoch.legacy_freq_times ?? habit.freq_times
    const days = epoch.legacy_freq_days ?? habit.freq_days
    return alphaFor(times / Math.max(1, days))
  }
  if (epoch.schedule_type === 'custom') {
    const freq = validCustomFrequency(epoch.legacy_freq_times, epoch.legacy_freq_days)
    return freq ? alphaFor(freq.times / freq.days) : OPPORTUNITY_ALPHA
  }
  return OPPORTUNITY_ALPHA
}

/** Was a weekly-target week achieved? Done entries count (including on
 *  vacation days — done wins); skipped rows are never done. Shared with the
 *  Overview completion series (Stage 4B) so the weekly rule lives in one
 *  place. */
export function weeklyTargetAchieved(
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
