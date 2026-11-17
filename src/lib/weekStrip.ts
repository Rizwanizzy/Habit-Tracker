import { addDays, parseLocalDate } from './dates'
import { weekStart, type ScheduleEpoch } from './schedule'
import { todayPair } from './todaySummary'
import type { Entry, Habit } from './score'

/** Stage 1A of UI 2.0 — the Today page's interactive seven-day (Mon–Sun)
 *  week strip. Pure builder: one WeekStripCell per day, whose completion
 *  indicator REUSES the approved `todayPair()` metric (same weekly-target
 *  semantics as the hero/ring-center — never a competing calculation).
 *
 *  Cell semantics:
 *  - future days (date > logical today) are placeholders with NO completion
 *    values (never display future completion) — the renderer disables them.
 *  - `paused` = vacation day with nothing achieved (habit timeline paused);
 *    done still wins: a vacation day WITH a check-in renders progress.
 *  - `neutral` = nothing eligible that day (every habit skipped, vacation-
 *    neutral, unscheduled, or before-start) — not a 0% miss.
 *  - the week is the SELECTED date's Monday–Sunday week (weekStart from
 *    schedule.ts), so navigating days with the existing chevrons/pill moves
 *    the strip with it — no duplicate navigation controls.
 *
 *  Data coverage: Today already loads 365 days of entries (useEntries) and
 *  400 days of vacation dates — more than enough for any reachable week; no
 *  extra fetching. */

export interface WeekStripInput {
  habits: readonly Habit[]
  entriesByHabit: Readonly<Record<string, readonly Entry[]>>
  /** Logical today (day-start aware). */
  today: string
  selectedDate: string
  /** Concrete vacation DATES (as vacationDatesInRange returns). */
  vacations?: readonly string[]
  epochsByHabit?: Readonly<Record<string, readonly ScheduleEpoch[] | undefined>>
}

export interface WeekStripCell {
  date: string
  /** Fixed weekday abbreviation (index-derived — deterministic, testable). */
  weekday: string
  /** Day-of-month number shown inside the indicator ring. */
  dayNumber: number
  future: boolean
  isToday: boolean
  selected: boolean
  /** The date is inside a vacation period (label context even when done wins). */
  vacation: boolean
  /** Vacation day with nothing achieved — paused styling. */
  paused: boolean
  /** Nothing eligible that day (all neutral) — muted, not a 0% miss. */
  neutral: boolean
  done: number
  total: number
  /** done/total (0 when nothing is eligible or the day is future). */
  fraction: number
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function buildWeekStrip({
  habits,
  entriesByHabit,
  today,
  selectedDate,
  vacations = [],
  epochsByHabit = {},
}: WeekStripInput): WeekStripCell[] {
  const monday = weekStart(selectedDate)
  const cells: WeekStripCell[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i)
    const future = date > today
    const base = {
      date,
      weekday: WEEKDAYS[i],
      dayNumber: parseLocalDate(date).getDate(),
      isToday: date === today,
      selected: date === selectedDate,
    }
    if (future) {
      cells.push({ ...base, future: true, vacation: false, paused: false, neutral: false, done: 0, total: 0, fraction: 0 })
      continue
    }
    const pair = todayPair({ habits, entriesByHabit, date, vacations, epochsByHabit })
    const vacation = vacations.includes(date)
    cells.push({
      ...base,
      future: false,
      vacation,
      paused: vacation && pair.done === 0,
      neutral: !vacation && pair.total === 0 && habits.length > 0,
      done: pair.done,
      total: pair.total,
      fraction: pair.total > 0 ? pair.done / pair.total : 0,
    })
  }
  return cells
}

/** Accessible label for one cell (locale-independent — fixed English
 *  abbreviations, matching the app's English copy). The renderer appends
 *  ", today" / ", selected". */
export function weekStripLabel(cell: WeekStripCell): string {
  const day = `${cell.weekday}, ${MONTHS[parseLocalDate(cell.date).getMonth()]} ${cell.dayNumber}`
  if (cell.future) return `${day} — future`
  if (cell.paused) return `${day} · vacation, habits paused`
  if (cell.neutral) return `${day} · nothing scheduled`
  const prog = cell.total > 0 ? ` · ${cell.done} of ${cell.total} done` : ''
  return cell.vacation ? `${day} · vacation · ${cell.done} of ${cell.total} done` : `${day}${prog}`
}
