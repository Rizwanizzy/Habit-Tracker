export const SMOOTHING_CONSTANT = 0.05

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
  sort_order?: number
  archived?: boolean
  /** Local YYYY-MM-DD date the habit counts from. */
  created_at: string
}

export type Entry = { date: string; value: number }

export function isDone(habit: Habit, entry: Entry | undefined): boolean {
  if (!entry) return false
  if (habit.type === 'numeric') return entry.value >= habit.target
  return entry.value > 0
}

export function perDayWeight(habit: Habit): number {
  const freqPerDay = habit.freq_times / Math.max(1, habit.freq_days)
  return 1 - Math.pow(1 - SMOOTHING_CONSTANT, freqPerDay)
}

export function scoreRange(
  habit: Habit,
  entries: Entry[],
  startDate: string,
  endDate: string,
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const weight = perDayWeight(habit)
  let score = 0
  let d = habit.created_at > startDate ? habit.created_at : startDate
  // ensure start not before created
  if (d < habit.created_at) d = habit.created_at
  while (d <= endDate) {
    const done = isDone(habit, byDate.get(d))
    score = score + (done ? 1 - score : 0 - score) * weight
    d = addDaysStr(d, 1)
  }
  return score
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

export function currentStreak(
  habit: Habit,
  entries: Entry[],
  asOf: string,
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  let streak = 0
  let d = asOf
  while (d >= habit.created_at) {
    if (isDone(habit, byDate.get(d))) {
      streak++
      d = addDaysStr(d, -1)
    } else {
      break
    }
  }
  return streak
}

export function bestStreak(habit: Habit, entries: Entry[]): number {
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
    if (isDone(habit, byDate.get(d))) {
      cur++
      if (cur > best) best = cur
    } else {
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
): number {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const start = habit.created_at > startDate ? habit.created_at : startDate
  let total = 0
  let done = 0
  let d = start
  while (d <= endDate) {
    total++
    if (isDone(habit, byDate.get(d))) done++
    d = addDaysStr(d, 1)
  }
  if (total === 0) return 0
  return done / total
}