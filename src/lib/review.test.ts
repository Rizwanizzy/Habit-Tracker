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
  habitOpportunities,
} from './review'
import type { ScheduleEpoch } from './schedule'
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

// --- Stage 4C: schedule-aware Review helpers -----------------------------------

function ep(over: Partial<ScheduleEpoch>): ScheduleEpoch {
  return {
    id: 'e1',
    effective_from: '2026-11-02',
    schedule_type: 'daily',
    scheduled_days: null,
    interval_days: null,
    weekly_target: null,
    legacy_freq_times: null,
    legacy_freq_days: null,
    ...over,
  }
}

const done = (date: string): Entry => ({ date, value: 1, status: 'done' })
const missed = (date: string): Entry => ({ date, value: 0, status: 'done' })

describe('Stage 4C habitOpportunities — daily/weekdays/interval/weekly_target/legacy epochs', () => {
  const habit = makeHabit('h1', 'Read', '2026-11-02')

  it('a daily epoch reproduces the no-epochs day-walk bit-identically', () => {
    const entries = [done('2026-11-02'), missed('2026-11-03'), done('2026-11-04')]
    const withEpoch = habitOpportunities(habit, entries, '2026-11-02', '2026-11-08', '2026-11-11', [], [ep({})])
    const withoutEpoch = habitOpportunities(habit, entries, '2026-11-02', '2026-11-08', '2026-11-11', [])
    expect(withEpoch.records).toEqual(withoutEpoch.records)
    expect(withEpoch.weekBased).toBe(false)
  })

  it('an explicitly empty epochs array behaves exactly like omitted', () => {
    const entries = [done('2026-11-02'), missed('2026-11-03')]
    expect(habitOpportunities(habit, entries, '2026-11-02', '2026-11-08', '2026-11-11', [], [])).toEqual(
      habitOpportunities(habit, entries, '2026-11-02', '2026-11-08', '2026-11-11', []),
    )
  })

  it('weekdays: off-days are neutral (not failures); done on an off-day still wins', () => {
    const epochs = [ep({ schedule_type: 'weekdays', scheduled_days: 42 })] // Mon | Wed | Fri (bits 1,3,5)
    const entries = [done('2026-11-09'), done('2026-11-11'), missed('2026-11-13')]
    const res = habitOpportunities(habit, entries, '2026-11-09', '2026-11-15', '2026-11-18', [], epochs)
    // Mon done, Tue off, Wed done, Thu off, Fri missed → 3 day opportunities
    expect(res.records).toHaveLength(3)
    expect(res.records[0].achieved).toBe(true)
    expect(res.records[1].achieved).toBe(true)
    expect(res.records[2].achieved).toBe(false)
    expect(res.weekBased).toBe(false)
    // A done check-in on the masked-off Tuesday counts (done wins).
    const tuesday = habitOpportunities(habit, [done('2026-11-10')], '2026-11-09', '2026-11-11', '2026-11-18', [], epochs)
    // 9=Mon (scheduled, no entry→missed), 10=Tue (off but done→counts), 11=Wed (scheduled, no entry→missed)
    expect(tuesday.records).toHaveLength(3)
    expect(tuesday.records[0].achieved).toBe(false)
    expect(tuesday.records[1].achieved).toBe(true)
    expect(tuesday.records[2].achieved).toBe(false)
  })

  it('interval: off-anchor days are neutral', () => {
    const epochs = [ep({ schedule_type: 'interval', interval_days: 3, effective_from: '2026-11-09' })]
    const entries = [done('2026-11-09'), done('2026-11-12'), missed('2026-11-15')]
    const res = habitOpportunities(habit, entries, '2026-11-09', '2026-11-15', '2026-11-18', [], epochs)
    // 09 (anchor) done, 12 (anchor) done, 15 (anchor) missed.
    expect(res.records).toHaveLength(3)
    expect(res.records[0].achieved).toBe(true)
    expect(res.records[1].achieved).toBe(true)
    expect(res.records[2].achieved).toBe(false)
    expect(res.weekBased).toBe(false)
  })

  it('legacy epochs reproduce the no-epochs day-walk bit-identically', () => {
    const legacyHabit = { ...habit, freq_times: 2, freq_days: 7 }
    const entries = [done('2026-11-02'), missed('2026-11-03'), done('2026-11-05')]
    expect(
      habitOpportunities(
        legacyHabit,
        entries,
        '2026-11-02',
        '2026-11-08',
        '2026-11-11',
        [],
        [ep({ schedule_type: 'legacy', legacy_freq_times: 2, legacy_freq_days: 7 })],
      ).records,
    ).toEqual(
      habitOpportunities(legacyHabit, entries, '2026-11-02', '2026-11-08', '2026-11-11', []).records,
    )
  })

  it('a schedule change mid-range: the daily era counts per day, the weekdays era drops off-days', () => {
    const epochs = [
      ep({ id: 'd1', schedule_type: 'daily', effective_from: '2026-11-01' }),
      ep({ id: 'w2', schedule_type: 'weekdays', scheduled_days: 42, effective_from: '2026-11-09' }),
    ]
    const entries = [done('2026-11-05'), done('2026-11-06'), done('2026-11-09'), done('2026-11-11')]
    const res = habitOpportunities(habit, entries, '2026-11-05', '2026-11-15', '2026-11-18', [], epochs)
    // Daily era (5–8): 5 done, 6 done, 7 missed, 8 missed → 4 records
    // Weekdays era (9–15): 9 done, 10 off, 11 done, 12 off, 13 missed, 14 off, 15 off → 3 records
    expect(res.records).toHaveLength(7)
    expect(res.weekBased).toBe(false)
  })
})

describe('Stage 4C habitOpportunities — weekly_target weeks as opportunities', () => {
  const habit = makeHabit('h1', 'Read', '2026-11-02')
  const epochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2 })]

  it('one opportunity per closed Mon–Sun week; the week containing today carries', () => {
    // today = 2026-11-18 makes week 2 closed (we=15 < 18), week 3 (16-22) current (today=18 Wed).
    // Set end = 2026-11-16 so week 2 (we=15) satisfies we < end.
    const entries = [done('2026-11-02'), done('2026-11-03'), done('2026-11-09')]
    const res = habitOpportunities(habit, entries, '2026-11-02', '2026-11-16', '2026-11-18', [], epochs)
    // Week 1 closes on 11-08 → achieved
    // Week 2 closes on 11-15 (< today 18 AND we=15 < end=16) → not achieved
    // Week 3 (16-22) contains today 18 → carries (no record)
    expect(res.records).toHaveLength(2)
    expect(res.records[0].anchor).toBe('2026-11-02')
    expect(res.records[0].achieved).toBe(true)
    expect(res.records[1].anchor).toBe('2026-11-09')
    expect(res.records[1].achieved).toBe(false)
    expect(res.weekBased).toBe(true)
  })

  it('skipped rows never count toward M; vacation-day dones do', () => {
    // Use end=16 so week 2 (we=15) qualifies: we < 16 AND we < today=18
    const entries: Entry[] = [
      done('2026-11-02'),
      done('2026-11-03'),
      done('2026-11-09'),
      { date: '2026-11-10', value: 0, status: 'skipped' },
    ]
    const res = habitOpportunities(habit, entries, '2026-11-02', '2026-11-16', '2026-11-18', [], epochs)
    // Week 1 achieved, week 2: 1 done + 1 skipped = 1 of 2 → not achieved
    expect(res.records).toHaveLength(2)
    expect(res.records[0].achieved).toBe(true)
    expect(res.records[1].achieved).toBe(false)

    // A done entry on a vacation day inside the week counts (done wins).
    const vac = ['2026-11-10']
    const withVac = habitOpportunities(
      habit,
      [done('2026-11-02'), done('2026-11-03'), done('2026-11-09'), done('2026-11-10')],
      '2026-11-02',
      '2026-11-16',
      '2026-11-18',
      vac,
      epochs,
    )
    expect(withVac.records[1].achieved).toBe(true)
  })

  it('a transition week (epoch effective Tue–Sun) carries; the first full week scores', () => {
    // Weekly epoch effective 2026-11-11 (Wed) → week 9-15 is transition.
    const tEpochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2, effective_from: '2026-11-11' })]
    const entries = [done('2026-11-16'), done('2026-11-17')]
    const res = habitOpportunities(habit, entries, '2026-11-02', '2026-11-23', '2026-11-25', [], tEpochs)
    // 11-02..10: no epoch governs → neutral carry
    // 11-11..15: transition → carry
    // 16-22: first full week, closes on 22 < today 25 → achieved (M=2)
    // 23-29: current week (today 25) → carries
    expect(res.records).toHaveLength(1)
    expect(res.records[0].anchor).toBe('2026-11-16')
    expect(res.records[0].achieved).toBe(true)
    expect(res.weekBased).toBe(true)
  })

  it('a partial week at the window start edge is not scored (scoring-law rule)', () => {
    // Window starts Wednesday of week 1 → that week is only partly covered.
    // Set end=16 so week 2 (we=15) qualifies: we < 16 AND we < today=18
    const entries = [done('2026-11-02'), done('2026-11-03'), done('2026-11-09'), done('2026-11-10')]
    const res = habitOpportunities(habit, entries, '2026-11-04', '2026-11-16', '2026-11-18', [], epochs)
    // Week 1: partial at the edge → carry; week 2: we=15 < today 18 AND we < end 16 → closed with 2 dones → achieved.
    expect(res.records).toHaveLength(1)
    expect(res.records[0].anchor).toBe('2026-11-09')
    expect(res.records[0].achieved).toBe(true)
  })

  it('a habit created mid-week: days before created_at are excluded, its partial week carries', () => {
    const satHabit = makeHabit('sat', 'Weekly', '2026-11-14') // Saturday
    const satEpochs = [ep({ schedule_type: 'weekly_target', weekly_target: 4, effective_from: '2026-11-14' })]
    const entries = [done('2026-11-16'), done('2026-11-17'), done('2026-11-18'), done('2026-11-19')]
    const res = habitOpportunities(satHabit, entries, '2026-11-09', '2026-11-23', '2026-11-25', [], satEpochs)
    // Partial week 9-15 before created_at → no records; week 16-22 full week closes 22 < today 25 → 1 record
    expect(res.records).toHaveLength(1)
    expect(res.records[0].anchor).toBe('2026-11-16')
    expect(res.records[0].achieved).toBe(true)
  })
})

describe('Stage 4C calculatePeriodReview — schedule-aware current/prev windows + trajectory', () => {
  const habit = makeHabit('h1', 'Read', '2026-11-02')
  const epochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2 })]
  // Period for weekly test: end=16 so current week (we=15) evaluates (we < end).
  // prevEnd=09 (Mon after the week) so prev week (we=8) evaluates (we < prevEnd).
  const periodWeekly = { type: 'weekly' as const, start: '2026-11-09', end: '2026-11-16', prevStart: '2026-11-02', prevEnd: '2026-11-09', label: '', prevLabel: '', offset: -1 }
  // Period for day-granular tests: end=15 (Sun), no extra Monday
  const periodDaily = { type: 'weekly' as const, start: '2026-11-09', end: '2026-11-15', prevStart: '2026-11-02', prevEnd: '2026-11-08', label: '', prevLabel: '', offset: -1 }

  it('weekly_target habits: current/prev windows count weeks, not days', () => {
    const entriesByHabit = {
      h1: [
        done('2026-11-02'), // prev week
        done('2026-11-03'), // prev week
        done('2026-11-09'), // current week
      ],
    }
    const summary = calculatePeriodReview({
      habits: [habit],
      entriesByHabit,
      period: periodWeekly,
      today: '2026-11-18', // makes current week closed, prev week closed
      epochsByHabit: { h1: epochs },
    })
    const perf = summary.habitPerformances[0]
    expect(perf.eligibleDays).toBe(1) // 1 week in current
    expect(perf.doneDays).toBe(0) // 1 done < M=2
    expect(perf.completionRate).toBe(0)
    expect(perf.prevEligibleDays).toBe(1) // 1 week in prev (we=8 < end=16)
    expect(perf.prevDoneDays).toBe(1) // prev week achieved
    expect(perf.weekBased).toBe(true)
  })

  it('weekdays/interval off-days stay neutral in both windows', () => {
    const wEpochs = [ep({ schedule_type: 'weekdays', scheduled_days: 42, effective_from: '2026-11-01' })] // Mon|Wed|Fri
    const entriesByHabit = {
      h1: [
        done('2026-11-02'), // prev Mon
        done('2026-11-04'), // prev Wed
        done('2026-11-09'), // curr Mon
        done('2026-11-11'), // curr Wed
      ],
    }
    const summary = calculatePeriodReview({
      habits: [habit],
      entriesByHabit,
      period: periodDaily,
      today: '2026-11-18',
      epochsByHabit: { h1: wEpochs },
    })
    const perf = summary.habitPerformances[0]
    // Prev week (11-02..08): Mon 11-02 done, Wed 11-04 done, Fri 11-06 missed → 3 day opps
    // Current week (11-09..15): Mon 11-09 done, Wed 11-11 done, Fri 11-13 missed → 3 day opps
    expect(perf.eligibleDays).toBe(3)
    expect(perf.doneDays).toBe(2)
    expect(perf.weekBased).toBe(false)
  })

  it('legacy epochs behave exactly like no epochs (bit-identical rates)', () => {
    const legacyHabit = { ...habit, freq_times: 1, freq_days: 1 }
    const entriesByHabit = {
      h1: [done('2026-11-02'), done('2026-11-09')],
    }
    const legacyEpochs = [ep({ schedule_type: 'legacy', legacy_freq_times: 1, legacy_freq_days: 1, effective_from: '2026-11-01' })]
    const withEpoch = calculatePeriodReview({
      habits: [legacyHabit],
      entriesByHabit,
      period: periodDaily,
      today: '2026-11-18',
      epochsByHabit: { h1: legacyEpochs },
    })
    const withoutEpoch = calculatePeriodReview({
      habits: [legacyHabit],
      entriesByHabit,
      period: periodDaily,
      today: '2026-11-18',
    })
    expect(withEpoch.habitPerformances[0].completionRate).toBeCloseTo(withoutEpoch.habitPerformances[0].completionRate)
    expect(withEpoch.habitPerformances[0].prevCompletionRate).toBeCloseTo(withoutEpoch.habitPerformances[0].prevCompletionRate)
  })
})

describe('Stage 4C calculateMonthlyWeeklyBreakdown & calculateYearlyMonthlyBreakdown — schedule-aware bucketing', () => {
  const habit = makeHabit('h1', 'Read', '2026-11-02')
  const epochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2 })]

  it('weekly-target weeks bucket by their Monday anchor across month chunks', () => {
    const entriesByHabit = {
      h1: [
        done('2026-11-02'), // week 1 Mon
        done('2026-11-03'), // week 1
        done('2026-11-09'), // week 2 Mon
        done('2026-11-10'), // week 2
      ],
    }
    const weeks = calculateMonthlyWeeklyBreakdown({
      habits: [habit],
      entriesByHabit,
      monthStart: '2026-11-01',
      monthEnd: '2026-11-30',
      today: '2026-12-05',
      epochsByHabit: { h1: epochs },
    })
    // Week 1 anchor 11-02 → chunk 1 (Nov 1-7)
    // Week 2 anchor 11-09 → chunk 2 (Nov 8-14)
    // Week 3 anchor 11-16 → chunk 3 (Nov 15-21)
    // Week 4 anchor 11-23 → chunk 4 (Nov 22-28)
    // Week 5 anchor 11-30 → chunk 5 (Nov 29-30)
    // Only weeks 1 & 2 have done entries; both achieved (M=2) → 2/2 in their chunks.
    expect(weeks[0].totalEligible).toBe(1)
    expect(weeks[0].totalDone).toBe(1)
    expect(weeks[1].totalEligible).toBe(1)
    expect(weeks[1].totalDone).toBe(1)
  })

  it('yearly monthly breakdown buckets weekly weeks by their Monday anchor', () => {
    // Need epoch effective from start of year for Jan/Feb weeks to be governed.
    // Also need habit created at start of year so habitOpportunities walks Jan/Feb.
    const yearHabit = makeHabit('hy', 'Yearly', '2026-01-01')
    const yearEpochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2, effective_from: '2026-01-01' })]
    const entriesByHabit = {
      hy: [
        done('2026-01-05'), // week 1 Mon Jan
        done('2026-01-06'),
        done('2026-02-02'), done('2026-02-03'), // week 1 Mon Feb (2 entries for M=2)
      ],
    }
    const months = calculateYearlyMonthlyBreakdown({
      habits: [yearHabit],
      entriesByHabit,
      year: 2026,
      today: '2026-03-01',
      epochsByHabit: { hy: yearEpochs },
    })
    // Jan 2026: weeks with Monday in Jan = Jan 5, 12, 19, 26 (4 weeks).
    // Only week 1 (Jan 5-11) has entries → 1 achieved.
    // Feb 2026: weeks with Monday in Feb = Feb 2, 9, 16 (3 weeks; Feb 23 week contains today=Mar 1, not evaluated).
    // Only week 1 (Feb 2-8) has entries → 1 achieved.
    expect(months[0].totalEligible).toBe(4) // January
    expect(months[0].totalDone).toBe(1)
    expect(months[1].totalEligible).toBe(3) // February
    expect(months[1].totalDone).toBe(1)
  })
})

describe('Stage 4C generateActionableInsights — weekBased wording', () => {
  const habit = makeHabit('h1', 'Read', '2026-11-02')

  it('uses "weeks" instead of "days" for weekly-target champion', () => {
    // Use monthly period to get multiple weeks (Nov 2026 has 4 weeks with Monday in Nov).
    // Need epoch effective from Nov 1 so all Nov weeks are governed.
    // Need 4/4 weeks achieved for >= 85% completion rate.
    const monthlyEpochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2, effective_from: '2026-11-01' })]
    const entriesByHabit = {
      h1: [
        done('2026-11-02'), done('2026-11-03'), // week 1 (Mon Nov 2) achieved
        done('2026-11-09'), done('2026-11-10'), // week 2 (Mon Nov 9) achieved
        done('2026-11-16'), done('2026-11-17'), // week 3 (Mon Nov 16) achieved
        done('2026-11-23'), done('2026-11-24'), // week 4 (Mon Nov 23) achieved
      ],
    }
    // Monthly period: Nov 1-30, prev Oct 1-31
    const period = { type: 'monthly' as const, start: '2026-11-01', end: '2026-11-30', prevStart: '2026-10-01', prevEnd: '2026-10-31', label: '', prevLabel: '', offset: 0 }
    const summary = calculatePeriodReview({
      habits: [habit],
      entriesByHabit,
      period,
      today: '2026-12-05',
      epochsByHabit: { h1: monthlyEpochs },
    })
    const insights = generateActionableInsights({ summary, periodType: 'monthly' })
    const champion = insights.find((i) => i.kind === 'celebration' && i.title.includes('Standout'))
    expect(champion).toBeDefined()
    expect(champion?.description).toContain('weeks completed')
  })
})
