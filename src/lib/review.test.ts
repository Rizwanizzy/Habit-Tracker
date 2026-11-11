import { describe, expect, it } from 'vitest'
import {
  calculateMonthlyWeeklyBreakdown,
  calculatePeriodReview,
  calculateYearlyMonthlyBreakdown,
  formatWeekLabel,
  generateActionableInsights,
  getCompletedMonthRange,
  getCompletedWeekRange,
  getCompletedYearRange,
  getPeriodRange,
} from './review'
import type { Entry, Habit } from './score'

function makeHabit(id: string, name: string, created_at = '2026-10-01', sort_order = 1): Habit {
  return {
    id,
    name,
    type: 'boolean',
    target: 1,
    freq_times: 1,
    freq_days: 1,
    created_at,
    sort_order,
  }
}

describe('Period Range Calculations', () => {
  it('calculates running week range (Sunday–Saturday) from a Wednesday', () => {
    // 2026-11-11 is a Wednesday
    const week = getCompletedWeekRange('2026-11-11', 0)
    expect(week.type).toBe('weekly')
    // Sunday of this week is Nov 8, 2026
    expect(week.start).toBe('2026-11-08')
    // Running week ends at present day Nov 11, 2026
    expect(week.end).toBe('2026-11-11')
    expect(week.label).toBe('November 8–11, 2026')

    // Preceding comparison period: Nov 1–4, 2026
    expect(week.prevStart).toBe('2026-11-01')
    expect(week.prevEnd).toBe('2026-11-04')
    expect(week.prevLabel).toBe('November 1–4, 2026')
  })

  it('calculates running week range on a Sunday', () => {
    // On Sunday 2026-11-08, running week is just Sunday itself
    const week = getCompletedWeekRange('2026-11-08', 0)
    expect(week.start).toBe('2026-11-08')
    expect(week.end).toBe('2026-11-08')
    expect(week.label).toBe('November 8, 2026')
  })

  it('calculates prior completed week range with offset = -1', () => {
    // 2026-11-11 (Wed): offset 0 is Nov 8-11; offset -1 is Sunday Nov 1 to Saturday Nov 7
    const week = getCompletedWeekRange('2026-11-11', -1)
    expect(week.start).toBe('2026-11-01')
    expect(week.end).toBe('2026-11-07')
    expect(week.label).toBe('November 1–7, 2026')
  })

  it('formats week label crossing month and year boundaries correctly', () => {
    expect(formatWeekLabel('2026-11-08', '2026-11-11')).toBe('November 8–11, 2026')
    expect(formatWeekLabel('2026-10-25', '2026-10-31')).toBe('October 25–31, 2026')
    expect(formatWeekLabel('2025-12-28', '2026-01-03')).toBe('December 28, 2025 – January 3, 2026')
  })

  it('calculates current running month range', () => {
    // Today is 2026-11-11. Offset 0 is current month November 2026.
    const month = getCompletedMonthRange('2026-11-11', 0)
    expect(month.type).toBe('monthly')
    expect(month.start).toBe('2026-11-01')
    expect(month.end).toBe('2026-11-30')
    expect(month.label).toBe('November 2026')

    // Preceding month for comparison: October 2026
    expect(month.prevStart).toBe('2026-10-01')
    expect(month.prevEnd).toBe('2026-10-31')
    expect(month.prevLabel).toBe('October 2026')

    // Offset -1 switches to October 2026
    const prevMonth = getCompletedMonthRange('2026-11-11', -1)
    expect(prevMonth.start).toBe('2026-10-01')
    expect(prevMonth.end).toBe('2026-10-31')
    expect(prevMonth.label).toBe('October 2026')
  })

  it('calculates month range crossing year boundary with offset', () => {
    // Today is 2026-01-15. Offset 0 is January 2026; offset -1 is December 2025.
    const month = getCompletedMonthRange('2026-01-15', -1)
    expect(month.start).toBe('2025-12-01')
    expect(month.end).toBe('2025-12-31')
    expect(month.label).toBe('December 2025')
    expect(month.prevStart).toBe('2025-11-01')
    expect(month.prevEnd).toBe('2025-11-30')
  })

  it('calculates completed year range', () => {
    // Today is 2026-11-11. Default year is current year 2026 (offset = 0).
    const year = getCompletedYearRange('2026-11-11', 0)
    expect(year.type).toBe('yearly')
    expect(year.start).toBe('2026-01-01')
    expect(year.end).toBe('2026-12-31')
    expect(year.label).toBe('2026')

    // Preceding year for comparison: 2025
    expect(year.prevStart).toBe('2025-01-01')
    expect(year.prevEnd).toBe('2025-12-31')
    expect(year.prevLabel).toBe('2025')

    // Offset -1 switches to 2025
    const prevYear = getCompletedYearRange('2026-11-11', -1)
    expect(prevYear.start).toBe('2025-01-01')
    expect(prevYear.end).toBe('2025-12-31')
    expect(prevYear.label).toBe('2025')
  })

  it('routes through getPeriodRange cleanly', () => {
    const w = getPeriodRange('weekly', '2026-11-11')
    const m = getPeriodRange('monthly', '2026-11-11')
    const y = getPeriodRange('yearly', '2026-11-11')
    expect(w.type).toBe('weekly')
    expect(m.type).toBe('monthly')
    expect(y.type).toBe('yearly')
  })
})

describe('calculatePeriodReview', () => {
  const h1 = makeHabit('h1', 'Read', '2026-10-01')
  const h2 = makeHabit('h2', 'Workout', '2026-10-01')

  it('calculates overall metrics and habit performance accurately', () => {
    // Offset -1 on 2026-11-11 is full completed week: Sunday Nov 1 to Saturday Nov 7, 2026
    const period = getCompletedWeekRange('2026-11-11', -1)

    const entriesByHabit: Record<string, Entry[]> = {
      h1: [
        { date: '2026-11-01', value: 1, status: 'done' },
        { date: '2026-11-02', value: 1, status: 'done' },
        { date: '2026-11-03', value: 1, status: 'done' },
        { date: '2026-11-04', value: 1, status: 'done' },
        { date: '2026-11-05', value: 1, status: 'done' },
        { date: '2026-11-06', value: 1, status: 'done' },
        { date: '2026-11-07', value: 1, status: 'done' },
      ],
      h2: [
        { date: '2026-11-01', value: 1, status: 'done' },
        { date: '2026-11-03', value: 1, status: 'done' },
        { date: '2026-11-05', value: 1, status: 'done' },
      ],
    }

    const summary = calculatePeriodReview({
      habits: [h1, h2],
      entriesByHabit,
      period,
      today: '2026-11-11',
    })

    // Total opportunities: 7 + 7 = 14
    expect(summary.totalEligibleOpportunities).toBe(14)
    // Total checkins: 7 + 3 = 10
    expect(summary.totalCheckIns).toBe(10)
    expect(summary.overallCompletionRate).toBeCloseTo(10 / 14)

    // Best performer should be h1 (100%)
    expect(summary.bestPerformers[0].habit.id).toBe('h1')
    expect(summary.bestPerformers[0].completionRate).toBe(1)
    expect(summary.bestPerformers[0].doneDays).toBe(7)

    // Needs attention should have h2 (3/7)
    expect(summary.needsAttention[0].habit.id).toBe('h2')
    expect(summary.needsAttention[0].doneDays).toBe(3)
    expect(summary.needsAttention[0].missedDays).toBe(4)
  })

  it('neutralizes skipped days from denominator', () => {
    const period = getCompletedWeekRange('2026-11-11', -1) // 7 days (Nov 1-7)
    const entriesByHabit: Record<string, Entry[]> = {
      h1: [
        { date: '2026-11-01', value: 1, status: 'done' },
        { date: '2026-11-02', value: 0, status: 'skipped' }, // skipped is neutral
        { date: '2026-11-03', value: 1, status: 'done' },
      ],
    }

    const summary = calculatePeriodReview({
      habits: [h1],
      entriesByHabit,
      period,
      today: '2026-11-11',
    })

    // 7 days minus 1 skipped = 6 eligible days
    const perf = summary.habitPerformances[0]
    expect(perf.eligibleDays).toBe(6)
    expect(perf.doneDays).toBe(2)
    expect(perf.missedDays).toBe(4)
    expect(perf.completionRate).toBeCloseTo(2 / 6)
  })

  it('neutralizes vacation days unless checked in', () => {
    const period = getCompletedWeekRange('2026-11-11', -1) // Nov 1-7
    const vacations = ['2026-11-02', '2026-11-03']

    const entriesByHabit: Record<string, Entry[]> = {
      h1: [
        { date: '2026-11-02', value: 1, status: 'done' }, // completed on vacation -> counts as done
        // 2026-11-03 has no entry -> vacation neutral
        { date: '2026-11-04', value: 1, status: 'done' },
      ],
    }

    const summary = calculatePeriodReview({
      habits: [h1],
      entriesByHabit,
      period,
      today: '2026-11-11',
      vacations,
    })

    const perf = summary.habitPerformances[0]
    // 7 days minus 1 uncompleted vacation day (Nov 3) = 6 eligible days
    expect(perf.eligibleDays).toBe(6)
    // 2 checkins (Nov 2 done + Nov 4 done)
    expect(perf.doneDays).toBe(2)
  })

  it('detects improving and declining trajectories vs preceding period', () => {
    const period = getCompletedWeekRange('2026-11-11', -1) // Curr: Nov 1-7, Prev: Oct 25-31

    const entriesByHabit: Record<string, Entry[]> = {
      // h1 improved: 1 done in prev week, 6 done in curr week
      h1: [
        { date: '2026-10-25', value: 1, status: 'done' },
        { date: '2026-11-01', value: 1, status: 'done' },
        { date: '2026-11-02', value: 1, status: 'done' },
        { date: '2026-11-03', value: 1, status: 'done' },
        { date: '2026-11-04', value: 1, status: 'done' },
        { date: '2026-11-05', value: 1, status: 'done' },
        { date: '2026-11-06', value: 1, status: 'done' },
      ],
      // h2 declined: 7 done in prev week, 1 done in curr week
      h2: [
        { date: '2026-10-25', value: 1, status: 'done' },
        { date: '2026-10-26', value: 1, status: 'done' },
        { date: '2026-10-27', value: 1, status: 'done' },
        { date: '2026-10-28', value: 1, status: 'done' },
        { date: '2026-10-29', value: 1, status: 'done' },
        { date: '2026-10-30', value: 1, status: 'done' },
        { date: '2026-10-31', value: 1, status: 'done' },
        { date: '2026-11-01', value: 1, status: 'done' },
      ],
    }

    const summary = calculatePeriodReview({
      habits: [h1, h2],
      entriesByHabit,
      period,
      today: '2026-11-11',
    })

    expect(summary.improvingHabits.some((p) => p.habit.id === 'h1')).toBe(true)
    expect(summary.decliningHabits.some((p) => p.habit.id === 'h2')).toBe(true)
  })

  it('handles mid-range created habit fairly', () => {
    // Habit created on Wednesday Nov 4 in a Nov 1-7 week
    const midHabit = makeHabit('mid', 'Meditation', '2026-11-04')
    const period = getCompletedWeekRange('2026-11-11', -1) // Nov 1-7

    const summary = calculatePeriodReview({
      habits: [midHabit],
      entriesByHabit: {
        mid: [
          { date: '2026-11-04', value: 1, status: 'done' },
          { date: '2026-11-05', value: 1, status: 'done' },
          { date: '2026-11-06', value: 1, status: 'done' },
          { date: '2026-11-07', value: 1, status: 'done' },
        ],
      },
      period,
      today: '2026-11-11',
    })

    const perf = summary.habitPerformances[0]
    // Days 1, 2, 3 are before creation -> only 4 eligible days (Nov 4, 5, 6, 7)
    expect(perf.eligibleDays).toBe(4)
    expect(perf.doneDays).toBe(4)
    expect(perf.completionRate).toBe(1)
    expect(perf.trajectory).toBe('new') // prev week had 0 eligible days
  })
})

describe('calculateMonthlyWeeklyBreakdown & calculateYearlyMonthlyBreakdown', () => {
  const h1 = makeHabit('h1', 'Water', '2026-01-01')

  it('breaks down monthly calendar into week segments', () => {
    const weeks = calculateMonthlyWeeklyBreakdown({
      habits: [h1],
      entriesByHabit: {},
      monthStart: '2026-10-01',
      monthEnd: '2026-10-31',
      today: '2026-11-11',
    })

    expect(weeks.length).toBeGreaterThanOrEqual(4)
    expect(weeks[0].startDate).toBe('2026-10-01')
    expect(weeks[weeks.length - 1].endDate).toBe('2026-10-31')
  })

  it('breaks down yearly calendar into 12 month segments', () => {
    const months = calculateYearlyMonthlyBreakdown({
      habits: [h1],
      entriesByHabit: {},
      year: 2025,
      today: '2026-11-11',
    })

    expect(months).toHaveLength(12)
    expect(months[0].name).toBe('January')
    expect(months[11].name).toBe('December')
  })
})

describe('generateActionableInsights', () => {
  const h1 = makeHabit('h1', 'Exercise', '2026-10-01')
  const period = getCompletedWeekRange('2026-11-11', -1) // Nov 1-7

  it('generates celebration insight for high completion habit', () => {
    const summary = calculatePeriodReview({
      habits: [h1],
      entriesByHabit: {
        h1: [
          { date: '2026-11-01', value: 1, status: 'done' },
          { date: '2026-11-02', value: 1, status: 'done' },
          { date: '2026-11-03', value: 1, status: 'done' },
          { date: '2026-11-04', value: 1, status: 'done' },
          { date: '2026-11-05', value: 1, status: 'done' },
          { date: '2026-11-06', value: 1, status: 'done' },
          { date: '2026-11-07', value: 1, status: 'done' },
        ],
      },
      period,
      today: '2026-11-11',
    })

    const insights = generateActionableInsights({
      summary,
      periodType: 'weekly',
    })

    expect(insights.length).toBeGreaterThan(0)
    expect(insights.some((i) => i.kind === 'celebration')).toBe(true)
    expect(insights[0].title).toContain('Exercise')
  })
})
