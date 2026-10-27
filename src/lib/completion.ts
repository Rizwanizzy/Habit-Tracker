import { addDays, daysBetween, parseLocalDate, toLocalDateString } from './dates'
import { dayStatus, isNeutral } from './dayStatus'
import type { Entry, Habit } from './score'

/** View modes of the completion card (Today page): 7 bar pills, a month
 *  calendar grid, or a GitHub-style year heatmap. */
export type ViewMode = 'week' | 'month' | 'year'

export type DayCompletion = {
  date: string
  /** Habits counted that day (created on or before it, active). */
  eligible: number
  done: number
  /** done / eligible (0 when no habit is eligible yet). */
  frac: number
}

/** Completion share of a single day: only habits that already existed
 *  (created_at on or before the date) are eligible, mirroring the rules
 *  that scoreRange uses. Entries are grouped per habit (unique per date).
 *  Neutral days (skipped/vacation) are excluded from the denominator, so
 *  eligible/done count only counted habits. */
export function dayCompletion(
  habits: Habit[],
  entriesByHabit: Record<string, Entry[]>,
  date: string,
  vacations: readonly string[] = [],
): DayCompletion {
  const eligible = habits.filter((h) => h.created_at <= date)
  let counted = 0
  let done = 0
  for (const h of eligible) {
    const status = dayStatus({
      habit: h,
      date,
      entry: (entriesByHabit[h.id] ?? []).find((e) => e.date === date),
      today: date,
      vacations,
    })
    if (isNeutral(status)) continue
    counted++
    if (status === 'done') done++
  }
  return { date, eligible: counted, done, frac: counted ? done / counted : 0 }
}

/** DayCompletion for a list of dates, in the same order. */
export function completionForDates(
  habits: Habit[],
  entriesByHabit: Record<string, Entry[]>,
  dates: string[],
  vacations: readonly string[] = [],
): DayCompletion[] {
  return dates.map((d) => dayCompletion(habits, entriesByHabit, d, vacations))
}

/** Single-color ramp (DESIGN.md §7 intensity rule): 0 = neutral track,
 *  otherwise the chosen color mixed in at 20…100% — higher completion
 *  reads stronger/darker on the glass surface. */
export function intensityPct(frac: number): number {
  if (!(frac > 0)) return 0
  return Math.min(100, Math.round(20 + frac * 80))
}

export type CalendarCell = string | null

/** Month calendar around `anchor` (any date in that month): weeks of 7
 *  Sun–Sat cells (`null` = before the 1st / past the last day). Pure. */
export function monthCalendar(anchor: string): CalendarCell[][] {
  const d = parseLocalDate(anchor)
  const y = d.getFullYear()
  const m = d.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const lead = new Date(y, m, 1).getDay() // 0 = Sunday, matching calendar rows
  const weeks: CalendarCell[][] = []
  let day = -lead
  while (day < daysInMonth) {
    const row: CalendarCell[] = []
    for (let i = 0; i < 7; i++) {
      row.push(day >= 0 && day < daysInMonth ? toLocalDateString(new Date(y, m, day + 1)) : null)
      day++
    }
    weeks.push(row)
  }
  return weeks
}

/** Year heatmap grid (GitHub-style): Sun–Sat rows as week columns, but
 *  windowed to the trailing `monthsBack + 1` months ending with the current
 *  month (so it fits the card without horizontal scrolling). The first
 *  column starts on the Sunday at/before the 1st of the oldest month; the
 *  last column ends the week that contains `today`. Pure. */
export function yearCalendar(today: string, monthsBack = 9): string[][] {
  const d = parseLocalDate(today)
  const first = new Date(d.getFullYear(), d.getMonth() - monthsBack, 1)
  const start = toLocalDateString(new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay()))
  const lastSunday = addDays(today, -d.getDay())
  const columns: string[][] = []
  for (let w = 0; w <= Math.floor(daysBetween(start, lastSunday) / 7); w++) {
    const col: string[] = []
    for (let i = 0; i < 7; i++) col.push(addDays(start, w * 7 + i))
    columns.push(col)
  }
  return columns
}

/** Month labels for a year grid: label a column when its first row's month
 *  differs from the previous column's (same rule as the habit Heatmap). */
export function yearMonthLabels(columns: string[][]): { col: number; text: string }[] {
  const fmt = new Intl.DateTimeFormat('en', { month: 'short' })
  const labels: { col: number; text: string }[] = []
  let prev = -1
  columns.forEach((col, w) => {
    const month = parseLocalDate(col[0]).getMonth()
    if (month !== prev) labels.push({ col: w, text: fmt.format(parseLocalDate(col[0])) })
    prev = month
  })
  return sparseMonthLabels(labels)
}

/** Drop month labels that have no room: when two months start within
 *  `minSpan` columns (e.g. the December sliver before Jan 1, or a month
 *  change mid-week), keep the month that owns more columns and drop the
 *  other — GitHub-style label thinning. Pure. */
export function sparseMonthLabels(
  labels: { col: number; text: string }[],
  minSpan = 3,
): { col: number; text: string }[] {
  if (labels.length < 2) return labels
  const out = labels.slice()
  let i = 0
  while (i < out.length - 1) {
    if (out[i + 1].col - out[i].col < minSpan) {
      // Columns each label owns, measured to the next label (the last one
      // owns everything after it).
      const spanA = out[i + 1].col - out[i].col
      const spanB = i + 2 < out.length ? out[i + 2].col - out[i + 1].col : Number.POSITIVE_INFINITY
      if (spanA <= spanB) out.splice(i, 1)
      else out.splice(i + 1, 1)
      // Re-check: the surviving label may now conflict with its neighbor.
    } else {
      i++
    }
  }
  return out
}
