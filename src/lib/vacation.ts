import { addDays } from './dates'

/** A vacation period (vacation_periods row): [start_date, end_date] INCLUSIVE,
 *  `end_date: null` = ONGOING — it covers every date from start_date onward.
 *  A vacation day is NEUTRAL for every habit (same removal-from-timeline
 *  rules as a skipped day), but done still wins: a check-in during vacation
 *  counts and extends the streak — vacation only forgives misses (the
 *  done > skipped > vacation > missed precedence lives in dayStatus). */
export interface VacationPeriod {
  id: string
  /** Local YYYY-MM-DD. */
  start_date: string
  /** Local YYYY-MM-DD, or null while the break is ongoing. */
  end_date: string | null
  created_at?: string
}

const ACTIVE_END = '9999-12-31' // stand-in for "still ongoing" in range math

function activeEnd(period: VacationPeriod): string {
  return period.end_date ?? ACTIVE_END
}

function isCalendarDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function overlaps(a: { start_date: string; end_date: string | null }, b: VacationPeriod): boolean {
  return a.start_date <= activeEnd(b) && b.start_date <= activeEnd(a as VacationPeriod)
}

/** True when `date` falls inside any period (end dates inclusive; ongoing
 *  periods cover every date from their start onward). Pure. */
export function isVacationDay(date: string, periods: readonly VacationPeriod[]): boolean {
  return periods.some((p) => date >= p.start_date && date <= activeEnd(p))
}

/** Validate a candidate period against the periods already in the app.
 *  Returns the error list (empty = valid): end before start, any overlap
 *  with an existing period (adjacent days are allowed), and at most one
 *  ongoing period. Dates must be real calendar dates. */
export function validatePeriod(
  existing: readonly VacationPeriod[],
  candidate: { start_date: string; end_date: string | null },
): string[] {
  const errors: string[] = []
  if (!isCalendarDate(candidate.start_date)) {
    errors.push('The start date is not a valid date.')
  }
  if (candidate.end_date !== null && !isCalendarDate(candidate.end_date)) {
    errors.push('The end date is not a valid date.')
  }
  if (errors.length === 0 && candidate.end_date !== null && candidate.end_date < candidate.start_date) {
    errors.push('The end date cannot be before the start date.')
  }
  if (errors.length === 0) {
    for (const period of existing) {
      if (overlaps(candidate, period)) {
        errors.push(
          `It overlaps an existing break (${period.start_date}${period.end_date ? ` – ${period.end_date}` : ', ongoing'}).`,
        )
        break
      }
    }
    if (candidate.end_date === null && existing.some((p) => p.end_date === null)) {
      errors.push('Only one break can be ongoing.')
    }
  }
  return errors
}

/** Normalised display order for period lists: start_date ascending, ties by
 *  created_at then id. Returns a new array; the input is not mutated. */
export function sortPeriods(periods: readonly VacationPeriod[]): VacationPeriod[] {
  return periods.slice().sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1
    const ca = a.created_at ?? ''
    const cb = b.created_at ?? ''
    if (ca !== cb) return ca < cb ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** The concrete vacation dates a stats window must know about (the shape
 *  dayStatus/score/completion accept): every date covered by a period,
 *  clipped to [rangeStart, rangeEnd] (an ongoing period clips at rangeEnd),
 *  deduplicated and sorted ascending. Pure. */
export function vacationDatesInRange(
  periods: readonly VacationPeriod[],
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const out = new Set<string>()
  for (const period of periods) {
    const from = period.start_date > rangeStart ? period.start_date : rangeStart
    const to = activeEnd(period) < rangeEnd ? activeEnd(period) : rangeEnd
    for (let d = from; d <= to; d = addDays(d, 1)) {
      out.add(d)
    }
  }
  return [...out].sort()
}
