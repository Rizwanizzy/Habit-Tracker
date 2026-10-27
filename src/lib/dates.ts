const TIME_ZONE = 'Asia/Kolkata'

export function toLocalDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function todayString(): string {
  return toLocalDateString(new Date())
}

export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseLocalDate(s)
  d.setDate(d.getDate() + n)
  return toLocalDateString(d)
}

export function daysBetween(a: string, b: string): number {
  const da = parseLocalDate(a).getTime()
  const db = parseLocalDate(b).getTime()
  return Math.round((db - da) / (1000 * 60 * 60 * 24))
}

// --- Logical days (day-start setting) ---------------------------------------
// A "logical day" is the Asia/Kolkata calendar date shifted back by the user's
// day-start hour: a check-in made at 01:30 with a 4 AM day start still counts
// for the previous calendar day. IST has no DST, so subtracting a fixed
// number of hours before formatting is exact.

/** Hours a day start can be set to (0 = midnight, the default behaviour). */
export const DAY_START_HOURS = [0, 1, 2, 3, 4, 5, 6] as const

export type DayStartHour = (typeof DAY_START_HOURS)[number]

export function isDayStartHour(n: unknown): n is DayStartHour {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6
}

/** The logical date of an instant: the Asia/Kolkata calendar date of
 *  `instant` minus `dayStartHour` hours. */
export function toLogicalDateString(instant: Date, dayStartHour = 0): string {
  return toLocalDateString(new Date(instant.getTime() - dayStartHour * 3_600_000))
}

/** The current logical date for the given instant. */
export function logicalToday(now: Date, dayStartHour = 0): string {
  return toLogicalDateString(now, dayStartHour)
}

/** Milliseconds until the next moment the logical date changes (the shifted
 *  clock crossing Asia/Kolkata midnight) — always > 0 (at the exact change
 *  instant it is a full day). */
export function msUntilNextDayStart(now: Date, dayStartHour = 0): number {
  const shifted = new Date(now.getTime() - dayStartHour * 3_600_000)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(shifted)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  // Milliseconds of the shifted clock since IST midnight. getMilliseconds is
  // the same in IST (a whole-minutes offset), so the real millisecond part
  // can be added directly.
  const msIntoDay = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + shifted.getMilliseconds()
  return 86_400_000 - msIntoDay
}

/** "12 AM", "1 AM", … "6 AM" — options for the day-start setting. */
export function formatDayStart(hour: number): string {
  return hour === 0 ? '12 AM' : `${hour} AM`
}