import { dayStatus, isNeutral } from './dayStatus'
import {
  isValidWeeklyTarget,
  opportunityScope,
  shouldShowHabitOnDate,
  type ScheduleEpoch,
} from './schedule'
import type { Entry, Habit } from './score'

/** The Today hero / ring-center completion pair — the summary "N / M done
 *  today" (and its percentage). Pure: composes dayStatus (the one source of
 *  truth for "is this day counted") with the Scheduled-view eligibility rule
 *  (shouldShowHabitOnDate). Deliberately NOT part of dayCompletion/completion
 *  statistics: Overview and the Week/Month/Year heatmap keep their week-
 *  scoped daily math (weekly-target habits excluded) — a documented,
 *  temporary divergence (PROJECT_CONTEXT, Stage 4A/4E).
 *
 *  Rules (approved 2026-11-17):
 *  - done wins everywhere: a check-in on the selected date counts as ONE
 *    completed habit — daily habits, scheduled weekdays/interval/custom days,
 *    weekly-target habits (including the day their weekly goal is achieved,
 *    and extra check-ins after it — done-wins), vacations and off-days.
 *  - neutral days (skipped / vacation / unscheduled, incl. weekly transition
 *    weeks) are excluded from BOTH sides — never a 0% miss.
 *  - before-start days are excluded (aligned with Scheduled-view hiding).
 *  - a pending weekly-target habit sits in the denominator while it is still
 *    visible in the Scheduled view; once its Mon–Sun goal is achieved it
 *    drops out of the pair on subsequent days (the check-in that reached the
 *    goal already counted on its own day).
 *  - every other pending scheduled habit stays in the denominator exactly as
 *    before this helper existed.
 *  - the pair NEVER reads the Scheduled/All-Habits toggle: it always counts
 *    ALL active habits, so switching views cannot change the summary. */

export interface TodayPairInput {
  habits: readonly Habit[]
  entriesByHabit: Readonly<Record<string, readonly Entry[]>>
  date: string
  /** Local YYYY-MM-DD vacation dates (dayStatus neutrality). */
  vacations?: readonly string[]
  /** Schedule epochs per habit (Stage 4A). */
  epochsByHabit?: Readonly<Record<string, readonly ScheduleEpoch[] | undefined>>
}

export interface TodayPair {
  done: number
  total: number
  /** Neutral habits — excluded from the pair (drives the all-skipped caption). */
  neutralCount: number
  /** Weekly-target habits currently inside the pair (done or pending) —
   *  part of the pair's composition (used by tests/consumers to know when
   *  weekly habits contribute). */
  weeklyCounted: number
}

/** Weekly-target detection. Mirrors the epoch/row predicate inside
 *  shouldShowHabitOnDate (schedule.ts:392–394): epochs decide when present,
 *  the habit row's own columns are the no-epochs fallback. */
function isWeeklyTargetHabit(
  habit: Habit,
  epochs: readonly ScheduleEpoch[] | undefined,
  date: string,
): boolean {
  if (epochs !== undefined && epochs.length > 0) {
    return opportunityScope(epochs, date) === 'week'
  }
  return habit.schedule_type === 'weekly_target' && isValidWeeklyTarget(habit.weekly_target)
}

export function todayPair({
  habits,
  entriesByHabit,
  date,
  vacations = [],
  epochsByHabit = {},
}: TodayPairInput): TodayPair {
  let done = 0
  let total = 0
  let neutralCount = 0
  let weeklyCounted = 0

  for (const habit of habits) {
    const entries = entriesByHabit[habit.id] ?? []
    const entry = entries.find((e) => e.date === date)
    const epochs = epochsByHabit[habit.id]
    const weekly = isWeeklyTargetHabit(habit, epochs, date)
    const status = dayStatus({ habit, date, entry, today: date, vacations, schedule: epochs })

    if (status === 'done') {
      done += 1
      total += 1
      if (weekly) weeklyCounted += 1
      continue
    }
    if (isNeutral(status)) {
      neutralCount += 1
      continue
    }
    if (status === 'before-start') {
      // Approved: historical dates exclude habits that had not started yet
      // (Scheduled view hides them too).
      continue
    }
    // Pending ('missed'). Non-weekly habits keep the exact pre-helper
    // behaviour: every pending scheduled day stays in the denominator.
    if (weekly && shouldShowHabitOnDate(habit, entries, date, date, vacations, epochs) !== 'visible') {
      // Weekly goal already achieved earlier this week (and no check-in on
      // the date itself — rule 1 counted that) → out of the pair.
      continue
    }
    total += 1
    if (weekly) weeklyCounted += 1
  }

  return { done, total, neutralCount, weeklyCounted }
}
