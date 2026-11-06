import type { Entry, Habit } from './score'

/** The status of a single habit-day (the one source of truth for every
 *  "is this day counted" question). Precedence: future first, then done
 *  (done always wins, including on backfills and vacations), then skipped,
 *  then before-start, then vacation, then missed. */
export type DayStatus = 'done' | 'missed' | 'skipped' | 'vacation' | 'before-start' | 'future'

/** Entry status as stored in the DB (`entries.status`, default 'done'). */
export type EntryStatus = 'done' | 'skipped'

/** The tap-cycle states the heatmap and the tile "more" menu work with.
 *  'empty' covers missed and unselected days; a status-done row below
 *  target (partial numeric) also counts as 'empty' (not done yet). */
export type DayAction = 'empty' | 'done' | 'skipped'

/** A row counts as done only for status 'done' (numeric: value >= target).
 *  A skipped row is NEVER done — nothing may infer anything from value when
 *  status is 'skipped' (skipped rows carry value 0 because the column is
 *  NOT NULL). Lives here so both score.ts (re-exported as isDone) and
 *  dayStatus share one predicate without an import cycle. */
export function isEntryDone(habit: Habit, entry: Entry | undefined): boolean {
  if (!entry) return false
  if (entry.status === 'skipped') return false
  if (habit.type === 'numeric') return entry.value >= habit.target
  return entry.value > 0
}

export interface DayStatusInput {
  habit: Habit
  date: string
  entry: Entry | undefined
  /** The caller's logical today — this file never reads the clock. */
  today: string
  /** Local YYYY-MM-DD vacation dates (wired, unused until the vacation task). */
  vacations?: readonly string[]
}

/** Classify one habit-day. A future day is out of scope before anything
 *  else; then done (done always wins, including on backfilled entries
 *  before created_at and check-ins during vacations), skipped, before-start,
 *  vacation and finally missed. */
export function dayStatus({ habit, date, entry, today, vacations = [] }: DayStatusInput): DayStatus {
  if (date > today) return 'future'
  if (isEntryDone(habit, entry)) return 'done'
  if (entry?.status === 'skipped') return 'skipped'
  if (date < habit.created_at) return 'before-start'
  if (vacations.includes(date)) return 'vacation'
  return 'missed'
}

/** Neutral days (skipped, vacation) are removed from the habit's timeline:
 *  they don't move the score, don't count and don't break streaks, and are
 *  excluded from completion-rate denominators. */
export function isNeutral(status: DayStatus): boolean {
  return status === 'skipped' || status === 'vacation'
}

/** The heatmap / tile-menu tap cycle: empty → done → skipped → empty.
 *  Pure; callers map real rows through dayActionFor first. */
export function nextDayAction(current: DayAction): DayAction {
  return current === 'empty' ? 'done' : current === 'done' ? 'skipped' : 'empty'
}

/** Map the stored row to the tap-cycle state (see nextDayAction). */
export function dayActionFor(habit: Habit, entry: Entry | undefined): DayAction {
  if (entry != null && isEntryDone(habit, entry)) return 'done'
  if (entry?.status === 'skipped') return 'skipped'
  return 'empty'
}
