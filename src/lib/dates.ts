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