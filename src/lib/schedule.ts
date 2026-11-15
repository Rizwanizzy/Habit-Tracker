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

export type ScheduleType = 'daily' | 'weekdays' | 'interval' | 'weekly_target' | 'custom'

/** The schedule a form/plan submits (the five modes including custom).
 *  `legacy` is a DB-history-only epoch type and never a form choice. */
export interface ScheduleConfig {
  schedule_type: ScheduleType
  scheduled_days?: number | null
  interval_days?: number | null
  weekly_target?: number | null
  /** Custom mode: X times every Y days (legacy_freq_times / legacy_freq_days). */
  legacy_freq_times?: number
  legacy_freq_days?: number
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
// Bit positions match JS getDay(): 0=Sun(1), 1=Mon(2), 2=Tue(4), 3=Wed(8),
// 4=Thu(16), 5=Fri(32), 6=Sat(64). Valid masks are 1–127.

export const SUNDAY = 1
export const MONDAY = 2
export const TUESDAY = 4
export const WEDNESDAY = 8
export const THURSDAY = 16
export const FRIDAY = 32
export const SATURDAY = 64

const ALL_WEEK_BITS = MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY

export function isValidWeekdayMask(mask: unknown): mask is number {
  return typeof mask === 'number' && Number.isInteger(mask) && mask >= 1 && mask <= ALL_WEEK_BITS
}

/** The date's weekday bit (local calendar; JS getDay 0 = Sunday). An invalid
 *  date string yields 0, which never matches a valid mask (1–127). */
export function weekdayBit(date: string): number {
  if (!isCalendarDate(date)) return 0
  const day = parseLocalDate(date).getDay()
  return day === 0 ? SUNDAY : 1 << day
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
  const { schedule_type, scheduled_days, interval_days, weekly_target, legacy_freq_times, legacy_freq_days } = config
  const hasDays = scheduled_days != null
  const hasInterval = interval_days != null
  const hasWeekly = weekly_target != null
  const hasLegacyFreq = legacy_freq_times != null || legacy_freq_days != null
  switch (schedule_type) {
    case 'daily':
      return hasDays || hasInterval || hasWeekly || hasLegacyFreq
        ? ['Daily habits do not take weekday, interval, weekly-target or custom frequency values.']
        : []
    case 'weekdays':
      if (!isValidWeekdayMask(scheduled_days)) return ['Pick at least one day of the week.']
      return hasInterval || hasWeekly || hasLegacyFreq ? ['Weekday schedules take a day mask only.'] : []
    case 'interval':
      if (!isValidInterval(interval_days)) return ['The interval must be 2 days or more.']
      return hasDays || hasWeekly || hasLegacyFreq ? ['Interval schedules take a day interval only.'] : []
    case 'weekly_target':
      if (!isValidWeeklyTarget(weekly_target)) return ['The weekly target must be 1 to 7 times a week.']
      return hasDays || hasInterval || hasLegacyFreq ? ['Weekly-target schedules take a weekly target only.'] : []
    case 'custom':
      if (legacy_freq_times == null || !Number.isInteger(legacy_freq_times) || legacy_freq_times < 1) {
        return ['Custom schedule requires Times to be a whole number of 1 or more.']
      }
      if (legacy_freq_days == null || !Number.isInteger(legacy_freq_days) || legacy_freq_days < 1) {
        return ['Custom schedule requires Per Days to be a whole number of 1 or more.']
      }
      if (legacy_freq_times > legacy_freq_days) return ['Times cannot exceed Per Days.']
      if (legacy_freq_days > 31) return ['Per Days cannot exceed 31.']
      return hasDays || hasInterval || hasWeekly ? ['Custom schedules take Times and Per Days only.'] : []
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
 *  where all days count).
 *  custom → every day (editable X-times-per-Y-days habits count all days as
 *  opportunities; scoring uses the freq mirror for EMA weight).
 *  Invalid dates or payloads are never eligible. */
export function isScheduledOn(date: string, epoch: ScheduleEpochRef): boolean {
  if (!isCalendarDate(date) || !isCalendarDate(epoch.effective_from)) return false
  if (date < epoch.effective_from) return false
  switch (epoch.schedule_type) {
    case 'daily':
    case 'legacy':
    case 'custom':
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

// --- Stage 3 wiring helpers (form + display) -----------------------------------
// Pure companions for the HabitForm/HabitDetail UI: the freq mirror the DB
// requires per mode, mask arithmetic and human labels. No React, no Supabase.

/** Form-level repeat mode: the four schedule types plus `legacy` — the frozen
 *  DB-history schedule shown as-is, never silently converted. */
export type ScheduleMode = ScheduleType | 'legacy'

/** Number of selected days in a weekday mask (popcount of the 7-bit mask). */
export function weekdayMaskCount(mask: number): number {
  let count = 0
  let rest = mask
  while (rest !== 0) {
    rest &= rest - 1
    count++
  }
  return count
}

/** The freq_times/freq_days pair the DB requires for a mode — the mirror the
 *  v7 append RPC writes (§8) and `habits_freq_mirror_ck` enforces. Legacy
 *  habits are absent on purpose: they keep their frozen user-chosen freq. */
export function freqMirrorFor(
  scheduleType: ScheduleType,
  params: Pick<ScheduleConfig, 'scheduled_days' | 'interval_days' | 'weekly_target' | 'legacy_freq_times' | 'legacy_freq_days'>,
): { freq_times: number; freq_days: number } {
  switch (scheduleType) {
    case 'daily':
      return { freq_times: 1, freq_days: 1 }
    case 'weekdays': {
      const mask = params.scheduled_days ?? 0
      if (!isValidWeekdayMask(mask)) throw new Error('Pick at least one day of the week.')
      return { freq_times: weekdayMaskCount(mask), freq_days: 7 }
    }
    case 'interval': {
      const interval = params.interval_days ?? 0
      if (!isValidInterval(interval)) throw new Error('The interval must be 2 days or more.')
      return { freq_times: 1, freq_days: interval }
    }
    case 'weekly_target': {
      const target = params.weekly_target ?? 0
      if (!isValidWeeklyTarget(target))
        throw new Error('The weekly target must be 1 to 7 times a week.')
      return { freq_times: target, freq_days: 7 }
    }
    case 'custom': {
      const times = params.legacy_freq_times ?? 0
      const days = params.legacy_freq_days ?? 0
      if (!Number.isInteger(times) || times < 1)
        throw new Error('Custom schedule requires Times to be a whole number of 1 or more.')
      if (!Number.isInteger(days) || days < 1)
        throw new Error('Custom schedule requires Per Days to be a whole number of 1 or more.')
      if (times > days) throw new Error('Times cannot exceed Per Days.')
      if (days > 31) throw new Error('Per Days cannot exceed 31.')
      return { freq_times: times, freq_days: days }
    }
  }
}

/** The day's opportunity scope under the governing epoch, or null when the
 *  date is ungoverned (before the first epoch): 'week' when a weekly_target
 *  epoch governs the date — INCLUDING its transition (partial) start week,
 *  so a habit created mid-week still shows weekly progress like "0/4 this
 *  week" instead of a misleading "Not scheduled" — and 'day' for the other
 *  scheduled modes (daily/weekdays/interval/legacy), null for their off-days.
 *  This is a DISPLAY/denominator scope only: scoring keeps its own rules
 *  (a transition week is neutral, never a failed weekly week) and dayStatus
 *  keeps transition days 'unscheduled'. Dashboards use it to keep weekly
 *  habits out of the daily done/total while their check-ins still count. */
export function opportunityScope(
  epochs: readonly ScheduleEpoch[],
  date: string,
): 'day' | 'week' | null {
  const epoch = resolveEpoch(epochs, date)
  if (epoch === undefined) return null
  if (epoch.schedule_type === 'weekly_target') {
    return isValidWeeklyTarget(epoch.weekly_target ?? 0) ? 'week' : null
  }
  return isScheduledOn(date, epoch) ? 'day' : null
}

// --- Stage 4E: Today visibility helpers ----------------------------------------

import { isEntryDone, type Habit } from './score'

/** Visibility scope for a habit on a given logical date.
 *  Returns 'visible' if the habit should appear in the Today grid/rings,
 *  'hidden' if it should be hidden. */
export type VisibilityScope = 'visible' | 'hidden'

/** Determines whether a habit should be visible in the Today dashboard on
 *  a specific logical date. This is a PURE display/visibility decision —
 *  it does not alter scoring, streaks, or any other calculations.
 *
 *  Rules:
 *  - Daily/weekdays/interval/legacy: visible on scheduled days; also visible
 *    on off-days IF there is a completed check-in (done wins for history).
 *  - Weekly-target: visible while the weekly goal is not yet achieved in that
 *    Mon–Sun week; hidden on subsequent days once the goal is achieved.
 *    The selected date's own completion ALWAYS keeps it visible (done wins).
 *  - Before the habit's created_at: hidden (no opportunity yet).
 *  - Future dates: handled by the caller (Today page restricts navigation).
 *  - Vacation days: visible (habits are paused but check-ins still count).
 *  - Transition weeks (weekly-target): treated as active for visibility;
 *    progress shows "0/M this partial week" but the habit is shown.
 *  - Historical dates (selectedDate !== today): visibility is determined by
 *    progress accumulated UP TO that date, not the current week's final total. */
export function shouldShowHabitOnDate(
  habit: Habit,
  entries: readonly { date: string; value: number; status?: 'done' | 'skipped' }[],
  date: string,
  today: string,
  _vacations: readonly string[],
  epochs?: readonly ScheduleEpoch[],
): VisibilityScope {
  // Before habit creation: no opportunity yet
  if (date < habit.created_at) return 'hidden'

  // Future dates: caller handles (Today page restricts navigation)
  if (date > today) return 'hidden'

  // Check if there's a done entry on this date (done wins for history)
  const entry = entries.find((e) => e.date === date)
  const doneOnDate = entry !== undefined && isEntryDone(habit, entry)

  // Resolve the governing epoch
  const epoch = epochs !== undefined && epochs.length > 0 ? resolveEpoch(epochs, date) : undefined

  // Weekly-target habits: week-scoped visibility
  const isWeeklyTarget =
    (epoch !== undefined && epoch.schedule_type === 'weekly_target' && isValidWeeklyTarget(epoch.weekly_target ?? 0)) ||
    (epoch === undefined && habit.schedule_type === 'weekly_target' && isValidWeeklyTarget(habit.weekly_target ?? 0))

  if (isWeeklyTarget) {
    // Done on this date always keeps it visible (history)
    if (doneOnDate) return 'visible'

    // Determine the Mon–Sun week for this date
    const weekStartDate = weekStart(date)
    const weekEndDate = weekEnd(date)

    // Count distinct completed days in this week UP TO the selected date
    // (for historical dates, we only count up to that date)
    const target = epoch !== undefined ? (epoch.weekly_target ?? 0) : (habit.weekly_target ?? 0)
    let doneInWeek = 0
    const byDate = new Map(entries.map((e) => [e.date, e]))
    let d = weekStartDate
    while (d <= weekEndDate && d <= date) {
      if (isEntryDone(habit, byDate.get(d))) doneInWeek++
      d = addDays(d, 1)
    }

    // If weekly goal already achieved before this date, hide (unless done today)
    if (doneInWeek >= target) return 'hidden'

    // Otherwise visible (including transition weeks showing 0/M)
    return 'visible'
  }

  // Daily/weekdays/interval/legacy: visible on scheduled days
  // Use epochs if available, otherwise fall back to habit row's schedule columns
  let scope: 'day' | 'week' | null
  if (epochs !== undefined && epochs.length > 0) {
    scope = opportunityScope(epochs, date)
  } else {
    // No epochs: use legacy habit row schedule
    const legacyEpoch: ScheduleEpochRef = {
      effective_from: habit.created_at,
      schedule_type: habit.schedule_type ?? 'daily',
      scheduled_days: habit.scheduled_days ?? null,
      interval_days: habit.interval_days ?? null,
      weekly_target: habit.weekly_target ?? null,
    }
    scope = isScheduledOn(date, legacyEpoch) ? 'day' : null
  }

  if (scope === 'day') return 'visible'

  // Off-day: only visible if there's a done check-in (history)
  if (doneOnDate) return 'visible'

  return 'hidden'
}

const WEEKDAY_BITS: ReadonlyArray<readonly [number, string]> = [
  [MONDAY, 'Mon'],
  [TUESDAY, 'Tue'],
  [WEDNESDAY, 'Wed'],
  [THURSDAY, 'Thu'],
  [FRIDAY, 'Fri'],
  [SATURDAY, 'Sat'],
  [SUNDAY, 'Sun'],
]

/** Human description of a schedule (habit row or epoch). Legacy habits show
 *  their frozen freq, never a converted mode; invalid params fall back to a
 *  neutral "Custom schedule" instead of throwing (display must not crash). */
export function scheduleLabel(s: {
  schedule_type: ScheduleMode
  scheduled_days?: number | null
  interval_days?: number | null
  weekly_target?: number | null
  freq_times?: number
  freq_days?: number
  legacy_freq_times?: number
  legacy_freq_days?: number
}): string {
  switch (s.schedule_type) {
    case 'daily':
      return 'Every day'
    case 'weekdays': {
      const mask = s.scheduled_days ?? 0
      if (!isValidWeekdayMask(mask)) return 'Custom schedule'
      return WEEKDAY_BITS.filter(([bit]) => (mask & bit) !== 0)
        .map(([, name]) => name)
        .join(', ')
    }
    case 'interval':
      return isValidInterval(s.interval_days ?? 0) ? `Every ${s.interval_days} days` : 'Custom schedule'
    case 'weekly_target':
      return isValidWeeklyTarget(s.weekly_target ?? 0)
        ? `${s.weekly_target}× per week`
        : 'Custom schedule'
    case 'legacy': {
      const times = s.freq_times ?? 0
      const days = s.freq_days ?? 0
      if (times < 1 || days < 1) return 'Custom schedule'
      return times === 1 && days === 1 ? 'Every day' : `${times} times every ${days} days`
    }
    case 'custom': {
      const times = s.legacy_freq_times ?? s.freq_times ?? 0
      const days = s.legacy_freq_days ?? s.freq_days ?? 0
      if (times < 1 || days < 1) return 'Custom schedule'
      return times === 1 && days === 1 ? 'Every day' : `${times} times every ${days} days`
    }
    default:
      return 'Custom schedule'
  }
}
