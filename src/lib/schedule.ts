import { addDays, daysBetween, parseLocalDate } from './dates'

/** Habit Scheduling — Stage 1 pure foundation (architecture gates: the DB
 *  migration, RPC wiring and scoring changes are later stages; nothing here
 *  touches Supabase, the clock or score.ts — dayStatus imports this module,
 *  never the reverse).
 *
 *  Modes: `daily` (every day), `weekdays` (7-bit weekday mask), `interval`
 *  (every N days anchored to the epoch's own effective date) and
 *  `weekly_target` (M completions per Monday–Sunday week; the Performance
 *  Review's Sunday–Saturday cadence is untouched). All dates are logical
 *  YYYY-MM-DD strings in the project's date-string convention. */

// --- Types ------------------------------------------------------------------

export type ScheduleType = 'daily' | 'weekdays' | 'interval' | 'weekly_target'

/** The schedule a form/plan submits (the four new modes; `legacy` is a
 *  DB-history-only epoch type and never a form choice). */
export interface ScheduleConfig {
  schedule_type: ScheduleType
  scheduled_days?: number | null
  interval_days?: number | null
  weekly_target?: number | null
}

/** One history epoch (mirrors the future `habit_schedule_history` row).
 *  `effective_from` is the logical date the epoch starts applying; the
 *  applicable epoch for a date is the latest one with effective_from ≤ date.
 *  `legacy` epochs carry the frozen freq snapshot of rollback-era habits. */
export interface ScheduleEpoch {
  id: string
  effective_from: string
  schedule_type: ScheduleType | 'legacy'
  scheduled_days: number | null
  interval_days: number | null
  weekly_target: number | null
  legacy_freq_times?: number | null
  legacy_freq_days?: number | null
}

/** The fields eligibility needs (works for full epochs and trimmed rows). */
export type ScheduleEpochRef = Pick<
  ScheduleEpoch,
  'effective_from' | 'schedule_type' | 'scheduled_days' | 'interval_days' | 'weekly_target'
>

// --- Weekday mask (weekdays mode) --------------------------------------------
// Monday = 1 … Sunday = 64 (seven-bit mask; valid masks are 1–127).

export const MONDAY = 1
export const TUESDAY = 2
export const WEDNESDAY = 4
export const THURSDAY = 8
export const FRIDAY = 16
export const SATURDAY = 32
export const SUNDAY = 64

const ALL_WEEK_BITS = MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY

export function isValidWeekdayMask(mask: unknown): mask is number {
  return typeof mask === 'number' && Number.isInteger(mask) && mask >= 1 && mask <= ALL_WEEK_BITS
}

/** The date's weekday bit (local calendar; JS getDay 0 = Sunday). An invalid
 *  date string yields 0, which never matches a valid mask (1–127). */
export function weekdayBit(date: string): number {
  if (!isCalendarDate(date)) return 0
  const day = parseLocalDate(date).getDay()
  return day === 0 ? SUNDAY : 1 << (day - 1)
}

// --- Validation (validatePeriod error-list convention) ------------------------

function isCalendarDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export function isValidInterval(interval: unknown): interval is number {
  return typeof interval === 'number' && Number.isInteger(interval) && interval >= 2
}

export function isValidWeeklyTarget(target: unknown): target is number {
  return typeof target === 'number' && Number.isInteger(target) && target >= 1 && target <= 7
}

/** Validate a candidate schedule payload. Returns the error list (empty =
 *  valid); each mode carries only its own value, mirroring the DB shape. */
export function validateSchedule(config: ScheduleConfig): string[] {
  const { schedule_type, scheduled_days, interval_days, weekly_target } = config
  const hasDays = scheduled_days != null
  const hasInterval = interval_days != null
  const hasWeekly = weekly_target != null
  switch (schedule_type) {
    case 'daily':
      return hasDays || hasInterval || hasWeekly
        ? ['Daily habits do not take weekday, interval or weekly-target values.']
        : []
    case 'weekdays':
      if (!isValidWeekdayMask(scheduled_days)) return ['Pick at least one day of the week.']
      return hasInterval || hasWeekly ? ['Weekday schedules take a day mask only.'] : []
    case 'interval':
      if (!isValidInterval(interval_days)) return ['The interval must be 2 days or more.']
      return hasDays || hasWeekly ? ['Interval schedules take a day interval only.'] : []
    case 'weekly_target':
      if (!isValidWeeklyTarget(weekly_target)) return ['The weekly target must be 1 to 7 times a week.']
      return hasDays || hasInterval ? ['Weekly-target schedules take a weekly target only.'] : []
    default:
      return ['Unknown repeat mode.']
  }
}

// --- Epoch resolution ---------------------------------------------------------

/** The epoch governing `date`: the latest effective_from on or before it.
 *  Among same-day epochs the LAST one in the array wins (history is
 *  append-only — callers pass epochs in append order; the DB's unique
 *  (habit_id, effective_from) makes same-day epochs impossible, so this is
 *  defensive). Dates before the first epoch resolve to undefined = never
 *  eligible. Single pass, no mutation. */
export function resolveEpoch(
  epochs: readonly ScheduleEpoch[],
  date: string,
): ScheduleEpoch | undefined {
  let best: ScheduleEpoch | undefined
  for (const epoch of epochs) {
    if (
      epoch.effective_from <= date &&
      (best === undefined || epoch.effective_from >= best.effective_from)
    ) {
      best = epoch
    }
  }
  return best
}

/** Effective-from ascending (same-day ties keep append order). Returns a new
 *  array; the input is never mutated. */
export function sortEpochs(epochs: readonly ScheduleEpoch[]): ScheduleEpoch[] {
  return epochs.slice().sort((a, b) =>
    a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0,
  )
}

// --- Eligibility --------------------------------------------------------------

/** Is `date` an opportunity under this epoch?
 *  daily → every day. weekdays → the weekday bit is selected. interval → the
 *  date is a whole multiple of N days from the epoch's OWN anchor (never the
 *  current date or clock). weekly_target → every day of an active week; the
 *  Mon–Sun week the epoch starts in is a neutral transition week when the
 *  epoch becomes effective Tuesday–Sunday (Monday starts are active at once).
 *  legacy → every day (frozen-freq habits keep the pre-scheduling behaviour
 *  where all days count). Invalid dates or payloads are never eligible. */
export function isScheduledOn(date: string, epoch: ScheduleEpochRef): boolean {
  if (!isCalendarDate(date) || !isCalendarDate(epoch.effective_from)) return false
  if (date < epoch.effective_from) return false
  switch (epoch.schedule_type) {
    case 'daily':
    case 'legacy':
      return true
    case 'weekdays':
      return (
        isValidWeekdayMask(epoch.scheduled_days) && (weekdayBit(date) & epoch.scheduled_days) !== 0
      )
    case 'interval':
      // The early `date < effective_from` guard keeps the modulo positive:
      // JS gives -0 for negative multiples, which would wrongly match.
      return (
        isValidInterval(epoch.interval_days) &&
        daysBetween(epoch.effective_from, date) % epoch.interval_days === 0
      )
    case 'weekly_target':
      if (!isValidWeeklyTarget(epoch.weekly_target)) return false
      // Transition week (starts Tue–Sun): only the epoch's own start week is
      // neutral; every later week is fully active.
      return weekdayBit(epoch.effective_from) === MONDAY || weekStart(epoch.effective_from) !== weekStart(date)
    default:
      return false
  }
}

// --- Monday–Sunday weeks -------------------------------------------------------

/** Monday of `date`'s week (weekly-target weeks run Monday–Sunday). */
export function weekStart(date: string): string {
  const day = parseLocalDate(date).getDay()
  if (!Number.isInteger(day)) return date // invalid input passes through, no throw
  return addDays(date, -((day + 6) % 7))
}

/** Sunday of `date`'s week. */
export function weekEnd(date: string): string {
  return addDays(weekStart(date), 6)
}

export interface WeekContext {
  weekStart: string
  weekEnd: string
  target: number
}

/** The weekly-target context of `date`'s Mon–Sun week, or null for an
 *  invalid target. */
export function weeklyTargetContext(date: string, target: number): WeekContext | null {
  if (!isValidWeeklyTarget(target)) return null
  return { weekStart: weekStart(date), weekEnd: weekEnd(date), target }
}

// --- Transition weeks (weekly-target rule) -------------------------------------

/** True when the Mon–Sun week this epoch starts in is a neutral transition
 *  week: a weekly_target epoch becoming effective Tuesday–Sunday. */
export function isTransitionEpoch(epoch: ScheduleEpochRef): boolean {
  return (
    epoch.schedule_type === 'weekly_target' &&
    isValidWeeklyTarget(epoch.weekly_target) &&
    isCalendarDate(epoch.effective_from) &&
    weekdayBit(epoch.effective_from) !== MONDAY
  )
}

/** The Mon–Sun week start of `epoch`'s neutral transition week, or null. */
export function transitionWeekStart(epoch: ScheduleEpochRef): string | null {
  return isTransitionEpoch(epoch) ? weekStart(epoch.effective_from) : null
}

/** Is the Mon–Sun week containing `date` a neutral transition week for these
 *  epochs? True when a weekly_target epoch becomes effective inside that week
 *  on a non-Monday day. Epochs already active before the week (or effective
 *  after it) don't affect it. Neutral weeks are neither achieved nor failed:
 *  excluded from weekly denominators, they never break weekly streaks. */
export function isTransitionWeek(epochs: readonly ScheduleEpoch[], date: string): boolean {
  const start = weekStart(date)
  const end = addDays(start, 6)
  return epochs.some(
    (epoch) => epoch.effective_from >= start && epoch.effective_from <= end && isTransitionEpoch(epoch),
  )
}
