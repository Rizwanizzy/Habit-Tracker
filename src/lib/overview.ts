import { addDays } from './dates'
import { dayStatus, isNeutral } from './dayStatus'
import {
  isTransitionWeek,
  isValidWeeklyTarget,
  resolveEpoch,
  weekEnd,
  weekStart,
  type ScheduleEpoch,
} from './schedule'
import { weeklyTargetAchieved, type Entry, type Habit, type ScorePoint } from './score'

/**
 * Calculates a cumulative daily completion percentage series for a habit over [startDate, endDate].
 *
 * For each day d:
 * - Only counts days on or after habit.created_at.
 * - Uses the established dayStatus logic where skipped days and vacation periods are neutral
 *   and excluded from the denominator.
 * - Done count / eligible count * 100, clamped safely, 0 when no eligible days exist.
 *
 * With schedule epochs supplied (Stage 4B), the walk mirrors the Stage 2
 * scoring law: daily/weekdays/interval/legacy dates count per day with
 * off-days neutral ('unscheduled' — neither eligible nor failed; a done
 * check-in on an off-day still wins), while a weekly_target habit is
 * evaluated per closed Monday–Sunday week — one opportunity per week,
 * achieved when its done entries reach M (never seven mandatory days).
 * Transition/partial weeks (epoch effective Tue–Sun, or a week only partly
 * inside the window) and the week containing endDate carry, exactly like the
 * scoring law. Historical epochs are honoured per date (resolveEpoch), so
 * past performance follows the schedule that governed it. Omitted or empty
 * epochs reproduce the legacy walk bit-identically.
 */
export function completionSeries(
  habit: Habit,
  entries: Entry[],
  startDate: string,
  endDate: string,
  vacations: readonly string[] = [],
  epochs?: readonly ScheduleEpoch[],
): ScorePoint[] {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const points: ScorePoint[] = []

  let eligibleCount = 0
  let doneCount = 0
  const rate = () => (eligibleCount > 0 ? doneCount / eligibleCount : 0)

  let d = habit.created_at > startDate ? habit.created_at : startDate
  while (d <= endDate) {
    if (epochs !== undefined && epochs.length > 0) {
      const epoch = resolveEpoch(epochs, d)
      if (epoch !== undefined && epoch.schedule_type === 'weekly_target' && isValidWeeklyTarget(epoch.weekly_target ?? 0)) {
        const ws = weekStart(d)
        const we = weekEnd(d)
        // Transition week (epoch effective Tue–Sun inside it) or a partial
        // week at the window edge (the walk entered mid-week): no weekly
        // step — carry through to next Monday. Earlier days of a transition
        // week were already walked under their governing epochs.
        if (isTransitionWeek(epochs, d) || ws < d) {
          for (let p = d; p <= we && p <= endDate; p = addDays(p, 1)) {
            points.push({ date: p, score: rate() })
          }
          d = addDays(we, 1)
          continue
        }
        if (we < endDate) {
          // Closed week (the week containing endDate is the current week and
          // is never evaluated).
          eligibleCount++
          if (weeklyTargetAchieved(habit, byDate, ws, we, epoch.weekly_target ?? 0)) doneCount++
        }
        for (let p = d; p <= we && p <= endDate; p = addDays(p, 1)) {
          points.push({ date: p, score: rate() })
        }
        d = addDays(we, 1)
        continue
      }
    }

    const status = dayStatus({
      habit,
      date: d,
      entry: byDate.get(d),
      today: endDate,
      vacations,
      schedule: epochs,
    })

    if (!isNeutral(status)) {
      eligibleCount++
      if (status === 'done') {
        doneCount++
      }
    }

    points.push({ date: d, score: rate() })
    d = addDays(d, 1)
  }

  return points
}

/**
 * Determines Top 5 habit IDs based on existing Overview ranking.
 *
 * Ranking criteria:
 * 1. Current metric value (final score/completion in the active range) descending (best habit first).
 * 2. Ties broken by the established habit order in `habits` (sort_order asc, created_at asc).
 *
 * If total habits <= 5, all habits are returned.
 */
export function getTop5HabitIds(
  habits: Habit[],
  metricValues: Map<string, number>,
): Set<string> {
  if (habits.length <= 5) {
    return new Set(habits.map((h) => h.id))
  }

  const sorted = [...habits].sort((a, b) => {
    const scoreA = metricValues.get(a.id) ?? 0
    const scoreB = metricValues.get(b.id) ?? 0
    if (scoreB !== scoreA) {
      return scoreB - scoreA
    }
    // Tie breaker: maintain established habit array ordering
    return habits.indexOf(a) - habits.indexOf(b)
  })

  return new Set(sorted.slice(0, 5).map((h) => h.id))
}

export type FilterMode = 'top5' | 'all' | 'none' | 'custom'

/**
 * Resolves the currently active filter mode given the visible habit IDs.
 */
export function resolveFilterMode(
  habits: Habit[],
  visibleIds: Set<string>,
  top5Ids: Set<string>,
): FilterMode {
  if (habits.length === 0) return 'all'
  if (visibleIds.size === 0) return 'none'
  if (visibleIds.size === habits.length) return 'all'

  // Check if visibleIds exactly matches top5Ids
  if (visibleIds.size === top5Ids.size) {
    let match = true
    for (const id of visibleIds) {
      if (!top5Ids.has(id)) {
        match = false
        break
      }
    }
    if (match) return 'top5'
  }

  return 'custom'
}
