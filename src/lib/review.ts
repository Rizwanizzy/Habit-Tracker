import { addDays, daysBetween, parseLocalDate, toLocalDateString } from './dates'
import { dayStatus, isNeutral } from './dayStatus'
import {
  isTransitionWeek,
  isValidWeeklyTarget,
  resolveEpoch,
  weekEnd,
  weekStart,
  type ScheduleEpoch,
} from './schedule'
import { scoreRange, weeklyTargetAchieved, type Entry, type Habit } from './score'

export type PeriodType = 'weekly' | 'monthly' | 'yearly'

export interface PeriodRange {
  type: PeriodType
  start: string
  end: string
  label: string
  prevStart: string
  prevEnd: string
  prevLabel: string
  offset: number
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Returns Sunday–Saturday week range relative to logical today.
 * offset = 0: current running week from Sunday up to present day.
 * offset = -1: preceding completed full week (Sunday–Saturday), etc.
 */
export function getCompletedWeekRange(today: string, offset = 0): PeriodRange {
  const d = parseLocalDate(today)
  const dayOfWeek = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  // Sunday of current running week
  const currentSunday = addDays(today, -dayOfWeek)

  // Target Sunday
  const start = addDays(currentSunday, offset * 7)
  const endOfWeek = addDays(start, 6)

  // If offset === 0, the week is currently running up to present day
  const end = offset === 0 ? (today > endOfWeek ? endOfWeek : today) : endOfWeek

  // Preceding week for comparison (same number of days when currently running)
  const daysInPeriod = offset === 0 ? daysBetween(start, end) : 6
  const prevStart = addDays(start, -7)
  const prevEnd = addDays(prevStart, daysInPeriod)

  return {
    type: 'weekly',
    start,
    end,
    label: formatWeekLabel(start, end),
    prevStart,
    prevEnd,
    prevLabel: formatWeekLabel(prevStart, prevEnd),
    offset,
  }
}

/** Formats a Sunday–Saturday range, e.g. "Nov 8–11, 2026" or "Nov 1–7, 2026". */
export function formatWeekLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)

  const sMonth = MONTH_NAMES[sm - 1]
  const eMonth = MONTH_NAMES[em - 1]

  if (start === end) {
    return `${sMonth} ${sd}, ${sy}`
  }

  if (sy === ey) {
    if (sm === em) {
      return `${sMonth} ${sd}–${ed}, ${sy}`
    }
    return `${sMonth} ${sd} – ${eMonth} ${ed}, ${sy}`
  }
  return `${sMonth} ${sd}, ${sy} – ${eMonth} ${ed}, ${ey}`
}

/**
 * Returns calendar month range relative to logical today.
 * offset = 0: current running calendar month (e.g. November 2026).
 * offset = -1: preceding completed calendar month (e.g. October 2026), etc.
 */
export function getCompletedMonthRange(today: string, offset = 0): PeriodRange {
  const [y, m] = today.split('-').map(Number)

  // Current month is (y, m - 1) in 0-indexed month.
  const targetDate = new Date(y, m - 1 + offset, 1)
  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth() + 1 // 1-indexed

  const start = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`

  // Last day of targetMonth
  const lastDayDate = new Date(targetYear, targetMonth, 0)
  const end = toLocalDateString(lastDayDate)

  // Preceding month for comparison
  const prevDate = new Date(targetYear, targetMonth - 1 - 1, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth() + 1
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevLastDay = new Date(prevYear, prevMonth, 0)
  const prevEnd = toLocalDateString(prevLastDay)

  return {
    type: 'monthly',
    start,
    end,
    label: `${MONTH_NAMES[targetMonth - 1]} ${targetYear}`,
    prevStart,
    prevEnd,
    prevLabel: `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`,
    offset,
  }
}

/**
 * Returns completed calendar year range relative to logical today.
 * offset = 0: most recently completed calendar year (e.g. 2025 when today is in 2026).
 * offset = -1: year before that, etc.
 */
export function getCompletedYearRange(today: string, offset = 0): PeriodRange {
  const currentYear = Number(today.slice(0, 4))
  const targetYear = currentYear + offset

  const start = `${targetYear}-01-01`
  const end = `${targetYear}-12-31`

  const prevYear = targetYear - 1
  const prevStart = `${prevYear}-01-01`
  const prevEnd = `${prevYear}-12-31`

  return {
    type: 'yearly',
    start,
    end,
    label: `${targetYear}`,
    prevStart,
    prevEnd,
    prevLabel: `${prevYear}`,
    offset,
  }
}

export function getPeriodRange(type: PeriodType, today: string, offset = 0): PeriodRange {
  switch (type) {
    case 'weekly':
      return getCompletedWeekRange(today, offset)
    case 'monthly':
      return getCompletedMonthRange(today, offset)
    case 'yearly':
      return getCompletedYearRange(today, offset)
  }
}

// --- Stage 4C: schedule-aware opportunity collection ---------------------------

/** One schedule-aware opportunity inside an aggregation window: a scheduled
 *  day (daily/weekdays/interval/legacy epochs, anchored at its own date) or a
 *  closed weekly-target Mon–Sun week (anchored at its Monday, evaluated over
 *  the full week). Neutral opportunities — off-days, vacations, skipped rows,
 *  transition/partial weeks, future days, the still-open current week — are
 *  never recorded, so they can neither help nor fail a rate. */
export interface OpportunityRecord {
  anchor: string
  achieved: boolean
}

export interface HabitOpportunities {
  records: OpportunityRecord[]
  /** True when every recorded opportunity was a weekly-target week. */
  weekBased: boolean
}

/**
 * Collects the schedule-aware opportunities for one habit over [start, end].
 *
 * Mirrors the Stage 2 scoring law and the Stage 4B completion series exactly:
 * - daily/weekdays/interval/legacy dates are opportunities per day via
 *   `dayStatus` — off-days are 'unscheduled' neutral (done check-ins on
 *   off-days still win); vacations and skipped rows are neutral;
 * - a weekly_target habit gets ONE opportunity per closed Mon–Sun week,
 *   achieved when its done entries reach M (`weeklyTargetAchieved` — skipped
 *   rows never count, vacation-day dones do); never seven daily obligations.
 *   Transition weeks (epoch effective Tue–Sun) and partial weeks at the
 *   window edge (the walk entered mid-week, or the week's Sunday lies beyond
 *   the window end) carry: no record, never a failure. The week containing
 *   `today` is the current week and is never evaluated, matching
 *   `scoreRange`'s `we < endDate` rule;
 * - historical epochs are honoured per date via `resolveEpoch`, so past
 *   performance follows the schedule that governed it. Omitted/empty epochs
 *   reproduce the pre-scheduling day-walk bit-identically.
 *
 * Records are anchored (day date / week Monday) so callers can both total
 * them over the whole window and re-bucket them into sub-windows (monthly
 * week chunks, yearly month chunks) without re-walking.
 */
export function habitOpportunities(
  habit: Habit,
  entries: Entry[],
  start: string,
  end: string,
  today: string,
  vacations: readonly string[] = [],
  epochs?: readonly ScheduleEpoch[],
): HabitOpportunities {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const records: OpportunityRecord[] = []
  let dayOpportunities = 0
  let weekOpportunities = 0

  let d = habit.created_at > start ? habit.created_at : start
  // Never evaluate dates beyond logical today: future dates are out of scope
  // and must not count as missed opportunities. Past periods (end < today)
  // are unaffected by this clamp.
  const effectiveEnd = end < today ? end : today
  while (d <= effectiveEnd) {
    const epoch = epochs !== undefined && epochs.length > 0 ? resolveEpoch(epochs, d) : undefined
    if (epoch !== undefined && epoch.schedule_type === 'weekly_target' && isValidWeeklyTarget(epoch.weekly_target ?? 0)) {
      const ws = weekStart(d)
      const we = weekEnd(d)
      // Transition week (epoch effective Tue–Sun inside it) or a partial week
      // at the window edge (ws < d): neutral — skip through to next Monday.
      if (isTransitionWeek(epochs ?? [], d) || ws < d) {
        d = addDays(we, 1)
        continue
      }
      // Closed within the window AND complete in real time: the week
      // containing today (or the window end) is never evaluated.
      if (we < end && we < today) {
        records.push({
          anchor: ws,
          achieved: weeklyTargetAchieved(habit, byDate, ws, we, epoch.weekly_target ?? 0),
        })
        weekOpportunities++
      }
      d = addDays(we, 1)
      continue
    }

    const status = dayStatus({
      habit,
      date: d,
      entry: byDate.get(d),
      today,
      vacations,
      schedule: epochs,
    })
    if (!isNeutral(status)) {
      records.push({ anchor: d, achieved: status === 'done' })
      dayOpportunities++
    }
    d = addDays(d, 1)
  }

  return { records, weekBased: dayOpportunities === 0 && weekOpportunities > 0 }
}

/** Counts the records anchored inside [start, end] (inclusive). */
function countRecords(
  records: readonly OpportunityRecord[],
  start: string,
  end: string,
): { eligible: number; done: number; missed: number } {
  let eligible = 0
  let done = 0
  let missed = 0
  for (const r of records) {
    if (r.anchor < start || r.anchor > end) continue
    eligible++
    if (r.achieved) done++
    else missed++
  }
  return { eligible, done, missed }
}

export interface HabitPeriodPerformance {
  habit: Habit
  eligibleDays: number
  doneDays: number
  missedDays: number
  completionRate: number
  score: number
  prevEligibleDays: number
  prevDoneDays: number
  prevCompletionRate: number
  prevScore: number
  deltaRate: number | null
  deltaScore: number | null
  trajectory: 'improving' | 'declining' | 'consistent' | 'new'
  /** True when every eligible opportunity in the CURRENT period was a
   *  weekly-target week (counters are week-granular; UI copy says "weeks"). */
  weekBased: boolean
}

export interface PeriodReviewSummary {
  period: PeriodRange
  totalCheckIns: number
  totalEligibleOpportunities: number
  overallCompletionRate: number
  overallScore: number
  prevOverallCompletionRate: number | null
  prevOverallScore: number | null
  completionDelta: number | null
  scoreDelta: number | null
  activeHabitsCount: number
  habitsWithActivityCount: number
  habitPerformances: HabitPeriodPerformance[]
  bestPerformers: HabitPeriodPerformance[]
  needsAttention: HabitPeriodPerformance[]
  improvingHabits: HabitPeriodPerformance[]
  decliningHabits: HabitPeriodPerformance[]
  consistentHabits: HabitPeriodPerformance[]
}

/**
 * Calculates complete performance review for a set of habits and entries in a given period.
 */
export function calculatePeriodReview({
  habits,
  entriesByHabit,
  period,
  today,
  vacations = [],
  epochsByHabit,
}: {
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  period: PeriodRange
  today: string
  vacations?: readonly string[]
  /** Schedule history per habit (Stage 4C). Omitted/empty = exact
   *  pre-scheduling behaviour. */
  epochsByHabit?: Record<string, ScheduleEpoch[]>
}): PeriodReviewSummary {
  const activeHabits = habits.filter((h) => !h.archived)
  const habitPerformances: HabitPeriodPerformance[] = []

  let totalCheckIns = 0
  let totalEligibleOpportunities = 0
  let habitsWithActivity = 0

  let prevTotalDone = 0
  let prevTotalEligible = 0

  for (const habit of activeHabits) {
    const entries = entriesByHabit[habit.id] ?? []
    const epochs = epochsByHabit?.[habit.id]

    // 1. Current period metrics — schedule-aware opportunities (per scheduled
    // day, or per closed weekly-target week; neutral days/weeks record nothing).
    const current = habitOpportunities(
      habit,
      entries,
      period.start,
      period.end,
      today,
      vacations,
      epochs,
    )
    const { eligible, done, missed } = countRecords(current.records, period.start, period.end)

    const completionRate = eligible > 0 ? done / eligible : 0
    // Clamp the score walk to logical today so future dates in the current
    // period (month/year) don't step the score as misses. Past periods
    // (period.end < today) are unaffected.
    const scoreEnd = period.end < today ? period.end : today
    const score = scoreRange(habit, entries, period.start, scoreEnd, vacations, epochs)

    if (done > 0) {
      habitsWithActivity++
    }

    totalCheckIns += done
    totalEligibleOpportunities += eligible

    // 2. Preceding period metrics
    const previous = habitOpportunities(
      habit,
      entries,
      period.prevStart,
      period.prevEnd,
      today,
      vacations,
      epochs,
    )
    const prev = countRecords(previous.records, period.prevStart, period.prevEnd)
    const prevEligible = prev.eligible
    const prevDone = prev.done

    const prevCompletionRate = prevEligible > 0 ? prevDone / prevEligible : 0
    const prevScore = scoreRange(habit, entries, period.prevStart, period.prevEnd, vacations, epochs)

    prevTotalDone += prevDone
    prevTotalEligible += prevEligible

    // 3. Trajectory determination
    let trajectory: 'improving' | 'declining' | 'consistent' | 'new'
    let deltaRate: number | null = null
    let deltaScore: number | null = null

    // Zero eligible opportunities is neutral — nothing to evaluate in this
    // period. Never label a zero-opportunity habit as improving or declining.
    if (eligible === 0) {
      trajectory = 'consistent'
    } else if (prevEligible > 0) {
      deltaRate = completionRate - prevCompletionRate
      deltaScore = score - prevScore

      if (deltaRate >= 0.05) {
        trajectory = 'improving'
      } else if (deltaRate <= -0.05) {
        trajectory = 'declining'
      } else {
        trajectory = 'consistent'
      }
    } else {
      // When prevEligible === 0:
      // If habit was created during the current period, mark as 'new'.
      // If habit existed prior to period start but has no previous-period data (e.g. Yearly review for habits created on Jan 1),
      // evaluate trajectory across the active window of the current period.
      const createdInPeriod = habit.created_at > period.start

      if (createdInPeriod) {
        trajectory = 'new'
      } else if (eligible >= 2) {
        const periodStart = habit.created_at > period.start ? habit.created_at : period.start
        const totalDays = daysBetween(periodStart, period.end) + 1
        const halfDays = Math.floor(totalDays / 2)
        const midDate = addDays(periodStart, Math.max(0, halfDays - 1))

        // Split the already-collected opportunities at the mid date. Day
        // opportunities anchor at their own date (identical to the previous
        // day-walk); weekly-target weeks anchor at their Monday, so a week
        // straddling the split counts whole in the half holding its Monday.
        const h1 = countRecords(current.records, periodStart, midDate)
        const h2 = countRecords(current.records, addDays(midDate, 1), period.end)
        const h1Eligible = h1.eligible
        const h1Done = h1.done
        const h2Eligible = h2.eligible
        const h2Done = h2.done

        const h1Rate = h1Eligible > 0 ? h1Done / h1Eligible : 0
        const h2Rate = h2Eligible > 0 ? h2Done / h2Eligible : 0

        if (h1Eligible > 0 && h2Eligible > 0) {
          deltaRate = h2Rate - h1Rate
          if (deltaRate >= 0.05) {
            trajectory = 'improving'
          } else if (deltaRate <= -0.05) {
            trajectory = 'declining'
          } else {
            trajectory = 'consistent'
          }
        } else if (completionRate >= 0.5) {
          trajectory = 'consistent'
        } else {
          trajectory = 'new'
        }
      } else {
        trajectory = 'consistent'
      }
    }

    habitPerformances.push({
      habit,
      eligibleDays: eligible,
      doneDays: done,
      missedDays: missed,
      completionRate,
      score,
      prevEligibleDays: prevEligible,
      prevDoneDays: prevDone,
      prevCompletionRate,
      prevScore,
      deltaRate,
      deltaScore,
      trajectory,
      weekBased: current.weekBased,
    })
  }

  // Calculate overall rates
  const overallCompletionRate =
    totalEligibleOpportunities > 0 ? totalCheckIns / totalEligibleOpportunities : 0

  const overallScore =
    habitPerformances.filter((p) => p.eligibleDays > 0).length > 0
      ? habitPerformances
          .filter((p) => p.eligibleDays > 0)
          .reduce((acc, p) => acc + p.score, 0) /
        habitPerformances.filter((p) => p.eligibleDays > 0).length
      : 0

  const prevOverallCompletionRate =
    prevTotalEligible > 0 ? prevTotalDone / prevTotalEligible : null

  const prevOverallScore =
    habitPerformances.filter((p) => p.prevEligibleDays > 0).length > 0
      ? habitPerformances
          .filter((p) => p.prevEligibleDays > 0)
          .reduce((acc, p) => acc + p.prevScore, 0) /
        habitPerformances.filter((p) => p.prevEligibleDays > 0).length
      : null

  const completionDelta =
    prevOverallCompletionRate != null ? overallCompletionRate - prevOverallCompletionRate : null

  const scoreDelta = prevOverallScore != null ? overallScore - prevOverallScore : null

  // Categorize habits
  // Best performers: highest completion rate, then score
  const sortedByPerf = [...habitPerformances].sort((a, b) => {
    if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate
    if (b.score !== a.score) return b.score - a.score
    return habits.indexOf(a.habit) - habits.indexOf(b.habit)
  })

  const bestPerformers = sortedByPerf.filter((p) => p.eligibleDays > 0 && p.completionRate >= 0.75)
  // If no habits >= 75%, take the top 2 with completion > 0
  const finalBest =
    bestPerformers.length > 0 ? bestPerformers : sortedByPerf.filter((p) => p.completionRate > 0).slice(0, 2)

  // Needs attention: percentage-point thresholds relative to the previous period.
  // A habit qualifies when it has eligible opportunities in the current period
  // and at least one condition holds:
  //   A. completionRate < 0.70 (below 70%)
  //   B. 0.70 <= completionRate < 0.90 with a >= 15 percentage point decline
  //   C. completionRate >= 0.90 with a >= 20 percentage point decline
  // deltaRate = completionRate - prevCompletionRate is a percentage-point difference.
  // Zero eligible opportunities and missing previous-period data never qualify.
  const needsAttention = [...habitPerformances]
    .filter((p) => {
      if (p.eligibleDays === 0) return false
      const rate = p.completionRate
      if (rate < 0.70) return true
      if (rate >= 0.70 && rate < 0.90 && p.prevEligibleDays > 0 && p.deltaRate != null && p.deltaRate <= -0.15) return true
      if (rate >= 0.90 && p.prevEligibleDays > 0 && p.deltaRate != null && p.deltaRate <= -0.20) return true
      return false
    })
    .sort((a, b) => {
      if (a.completionRate !== b.completionRate) return a.completionRate - b.completionRate
      return b.missedDays - a.missedDays
    })

  const improvingHabits = habitPerformances.filter((p) => p.trajectory === 'improving')
  const decliningHabits = habitPerformances.filter((p) => p.trajectory === 'declining')
  const consistentHabits = habitPerformances.filter(
    (p) => p.trajectory === 'consistent' && p.eligibleDays > 0,
  )

  return {
    period,
    totalCheckIns,
    totalEligibleOpportunities,
    overallCompletionRate,
    overallScore,
    prevOverallCompletionRate,
    prevOverallScore,
    completionDelta,
    scoreDelta,
    activeHabitsCount: activeHabits.length,
    habitsWithActivityCount: habitsWithActivity,
    habitPerformances,
    bestPerformers: finalBest,
    needsAttention,
    improvingHabits,
    decliningHabits,
    consistentHabits,
  }
}

export interface MonthlyWeekBreakdown {
  weekIndex: number
  label: string
  startDate: string
  endDate: string
  totalDone: number
  totalEligible: number
  completionRate: number
}

/**
 * Calculates weekly completion breakdown for a calendar month.
 *
 * Schedule-aware (Stage 4C): each habit's opportunities are collected once
 * over the whole month via `habitOpportunities` (day opportunities anchored at
 * their date, weekly-target weeks at their Monday) and then bucketed into the
 * month's 7-day chunks by anchor — so a weekly-target week counts whole in
 * the chunk containing its Monday, never as seven daily obligations, and
 * chunk-edge neutral days stay neutral.
 */
export function calculateMonthlyWeeklyBreakdown({
  habits,
  entriesByHabit,
  monthStart,
  monthEnd,
  today,
  vacations = [],
  epochsByHabit,
}: {
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  monthStart: string
  monthEnd: string
  today: string
  vacations?: readonly string[]
  epochsByHabit?: Record<string, ScheduleEpoch[]>
}): MonthlyWeekBreakdown[] {
  // Collect each habit's opportunities for the month once, keyed by anchor.
  const perHabit: OpportunityRecord[][] = []
  for (const habit of habits) {
    if (habit.archived) continue
    const entries = entriesByHabit[habit.id] ?? []
    const collected = habitOpportunities(
      habit,
      entries,
      monthStart,
      monthEnd,
      today,
      vacations,
      epochsByHabit?.[habit.id],
    )
    perHabit.push(collected.records)
  }

  const weeks: MonthlyWeekBreakdown[] = []
  let currentStart = monthStart
  let weekIndex = 1

  while (currentStart <= monthEnd) {
    const endCandidate = addDays(currentStart, 6)
    const currentEnd = endCandidate > monthEnd ? monthEnd : endCandidate

    let totalDone = 0
    let totalEligible = 0

    for (const records of perHabit) {
      const { eligible, done } = countRecords(records, currentStart, currentEnd)
      totalEligible += eligible
      totalDone += done
    }

    const rate = totalEligible > 0 ? totalDone / totalEligible : 0
    weeks.push({
      weekIndex,
      label: `Week ${weekIndex}`,
      startDate: currentStart,
      endDate: currentEnd,
      totalDone,
      totalEligible,
      completionRate: rate,
    })

    currentStart = addDays(currentEnd, 1)
    weekIndex++
  }

  return weeks
}

export interface YearlyMonthBreakdown {
  month: number
  name: string
  short: string
  totalDone: number
  totalEligible: number
  completionRate: number
}

/**
 * Calculates monthly breakdown for a calendar year (Jan–Dec).
 *
 * Schedule-aware (Stage 4C): each habit's opportunities are collected once
 * over the year via `habitOpportunities` and bucketed into calendar months by
 * anchor — weekly-target weeks count whole in the month containing their
 * Monday, never as seven daily obligations.
 */
export function calculateYearlyMonthlyBreakdown({
  habits,
  entriesByHabit,
  year,
  today,
  vacations = [],
  epochsByHabit,
}: {
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  year: number
  today: string
  vacations?: readonly string[]
  epochsByHabit?: Record<string, ScheduleEpoch[]>
}): YearlyMonthBreakdown[] {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // Collect each habit's opportunities for the year once, keyed by anchor.
  const perHabit: OpportunityRecord[][] = []
  for (const habit of habits) {
    if (habit.archived) continue
    const entries = entriesByHabit[habit.id] ?? []
    const collected = habitOpportunities(
      habit,
      entries,
      yearStart,
      yearEnd,
      today,
      vacations,
      epochsByHabit?.[habit.id],
    )
    perHabit.push(collected.records)
  }

  const result: YearlyMonthBreakdown[] = []

  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0')
    const start = `${year}-${mStr}-01`
    const lastDay = new Date(year, m, 0).getDate()
    const end = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`

    let totalDone = 0
    let totalEligible = 0

    for (const records of perHabit) {
      const { eligible, done } = countRecords(records, start, end)
      totalEligible += eligible
      totalDone += done
    }

    const rate = totalEligible > 0 ? totalDone / totalEligible : 0
    result.push({
      month: m,
      name: MONTH_NAMES[m - 1],
      short: MONTH_SHORT[m - 1],
      totalDone,
      totalEligible,
      completionRate: rate,
    })
  }

  return result
}

export interface ActionableInsight {
  id: string
  kind: 'celebration' | 'improvement' | 'focus' | 'tip'
  title: string
  description: string
  habitId?: string
}

/**
 * Pure deterministic actionable insight generation based on real habit data.
 */
export function generateActionableInsights({
  summary,
  periodType,
}: {
  summary: PeriodReviewSummary
  periodType: PeriodType
}): ActionableInsight[] {
  const insights: ActionableInsight[] = []
  const { habitPerformances, overallCompletionRate, completionDelta } = summary

  if (habitPerformances.length === 0) {
    return [
      {
        id: 'no-habits',
        kind: 'tip',
        title: 'Begin Tracking Your Routine',
        description: 'Add habits and complete daily check-ins to generate performance insights.',
      },
    ]
  }

  // 1. High consistency champion
  const topHabit = [...habitPerformances]
    .filter((p) => p.eligibleDays >= 3 && p.completionRate >= 0.85)
    .sort((a, b) => b.completionRate - a.completionRate)[0]

  if (topHabit) {
    const pct = Math.round(topHabit.completionRate * 100)
    const unit = topHabit.weekBased ? 'weeks' : 'days'
    insights.push({
      id: `champion-${topHabit.habit.id}`,
      kind: 'celebration',
      title: `Standout Consistency: ${topHabit.habit.name}`,
      description: `Achieved ${pct}% completion with ${topHabit.doneDays} of ${topHabit.eligibleDays} ${unit} completed. Keep this routine anchored!`,
      habitId: topHabit.habit.id,
    })
  }

  // 2. Improving habit progress
  const mostImproved = [...habitPerformances]
    .filter((p) => (p.deltaRate ?? 0) >= 0.15)
    .sort((a, b) => (b.deltaRate ?? 0) - (a.deltaRate ?? 0))[0]

  if (mostImproved && mostImproved.deltaRate != null) {
    const leap = Math.round(mostImproved.deltaRate * 100)
    insights.push({
      id: `improved-${mostImproved.habit.id}`,
      kind: 'improvement',
      title: `Strong Momentum on ${mostImproved.habit.name}`,
      description: `Performance climbed by +${leap}% compared to the previous period. Your deliberate practice is producing tangible results.`,
      habitId: mostImproved.habit.id,
    })
  }

  // 3. Habit needing focus / attention
  const needsFocus = [...habitPerformances]
    .filter((p) => p.eligibleDays >= 3 && p.missedDays >= 2 && p.completionRate < 0.6)
    .sort((a, b) => a.completionRate - b.completionRate)[0]

  if (needsFocus) {
    const nextPeriodWord = periodType === 'weekly' ? 'next week' : periodType === 'monthly' ? 'next month' : 'next year'
    insights.push({
      id: `focus-${needsFocus.habit.id}`,
      kind: 'focus',
      title: `Reset & Rebuild: ${needsFocus.habit.name}`,
      description: `${needsFocus.missedDays} opportunities were missed. Consider reducing friction for ${nextPeriodWord} with a 2-minute starter version.`,
      habitId: needsFocus.habit.id,
    })
  }

  // 4. Overall trajectory insight
  if (completionDelta != null && Math.abs(completionDelta) >= 0.05) {
    const deltaPct = Math.round(Math.abs(completionDelta) * 100)
    if (completionDelta > 0) {
      insights.push({
        id: 'trajectory-positive',
        kind: 'celebration',
        title: 'Overall Trajectory Heading Up',
        description: `Your average habit completion rate rose by +${deltaPct}% over the prior period. Continue building on this foundation.`,
      })
    } else {
      insights.push({
        id: 'trajectory-negative',
        kind: 'tip',
        title: 'Consistency Reset',
        description: `Overall completion eased by -${deltaPct}%. Focus on 1–2 essential core habits before expanding your routine.`,
      })
    }
  } else if (overallCompletionRate >= 0.8) {
    insights.push({
      id: 'trajectory-steady-high',
      kind: 'celebration',
      title: 'Rock-Solid Reliability',
      description: `Maintained a strong ${Math.round(overallCompletionRate * 100)}% overall completion rate across all active habits.`,
    })
  } else if (insights.length < 2) {
    insights.push({
      id: 'trajectory-default-tip',
      kind: 'tip',
      title: 'Anchor Your Daily Habits',
      description: 'Stack newer habits directly onto established morning or evening routines to naturally minimize friction.',
    })
  }

  return insights.slice(0, 4)
}
