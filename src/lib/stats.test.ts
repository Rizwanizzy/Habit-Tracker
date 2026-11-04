import { describe, expect, it } from 'vitest'
import { lifetimeStats } from './stats'
import type { Entry, Habit } from './score'

describe('lifetimeStats', () => {
  it('handles empty inputs', () => {
    const res = lifetimeStats({
      habits: [],
      entries: [],
      today: '2026-11-04',
    })
    expect(res).toEqual({
      longestStreak: { days: 0, habitId: null },
      totalCheckIns: 0,
      consistency30: null,
      daysTracking: 0,
      activeHabits: 0,
      archivedHabits: 0,
    })
  })

  it('measures longest streak across several habits including an archived one', () => {
    const habitActive: Habit = {
      id: 'h-active',
      name: 'Workout',
      type: 'boolean',
      target: 1,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-10-01',
      archived: false,
    }
    const habitArchived: Habit = {
      id: 'h-archived',
      name: 'Meditate',
      type: 'boolean',
      target: 1,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-09-01',
      archived: true,
    }

    // Active habit has a 3-day streak
    const entriesActive = [
      { habit_id: 'h-active', date: '2026-10-10', value: 1, status: 'done' as const },
      { habit_id: 'h-active', date: '2026-10-11', value: 1, status: 'done' as const },
      { habit_id: 'h-active', date: '2026-10-12', value: 1, status: 'done' as const },
    ]

    // Archived habit had a 7-day streak
    const entriesArchived = [
      { habit_id: 'h-archived', date: '2026-09-01', value: 1, status: 'done' as const },
      { habit_id: 'h-archived', date: '2026-09-02', value: 1, status: 'done' as const },
      { habit_id: 'h-archived', date: '2026-09-03', value: 1, status: 'done' as const },
      { habit_id: 'h-archived', date: '2026-09-04', value: 1, status: 'done' as const },
      { habit_id: 'h-archived', date: '2026-09-05', value: 1, status: 'done' as const },
      { habit_id: 'h-archived', date: '2026-09-06', value: 1, status: 'done' as const },
      { habit_id: 'h-archived', date: '2026-09-07', value: 1, status: 'done' as const },
    ]

    const res = lifetimeStats({
      habits: [habitActive, habitArchived],
      entries: [...entriesActive, ...entriesArchived],
      today: '2026-11-04',
    })

    // The archived habit has the longest all-time streak (7 days)
    expect(res.longestStreak).toEqual({
      days: 7,
      habitId: 'h-archived',
    })
    expect(res.totalCheckIns).toBe(10)
    expect(res.activeHabits).toBe(1)
    expect(res.archivedHabits).toBe(1)
  })

  it('ignores numeric-below-target and skipped entries for totalCheckIns', () => {
    const habitNum: Habit = {
      id: 'h-num',
      name: 'Water',
      type: 'numeric',
      target: 2000,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-11-01',
    }

    const entries: (Entry & { habit_id: string })[] = [
      // Met target
      { habit_id: 'h-num', date: '2026-11-01', value: 2000, status: 'done' },
      // Exceeded target
      { habit_id: 'h-num', date: '2026-11-02', value: 2500, status: 'done' },
      // Below target: should NOT count as done
      { habit_id: 'h-num', date: '2026-11-03', value: 1500, status: 'done' },
      // Skipped row: should NOT count as done
      { habit_id: 'h-num', date: '2026-11-04', value: 0, status: 'skipped' },
    ]

    const res = lifetimeStats({
      habits: [habitNum],
      entries,
      today: '2026-11-04',
    })

    expect(res.totalCheckIns).toBe(2)
  })

  it('computes 30-day consistency respecting created_at, skipped days and vacations', () => {
    // Habit created 10 days ago (2026-10-26 to today 2026-11-04 = 10 eligible days if no skips)
    const habit: Habit = {
      id: 'h1',
      name: 'Run',
      type: 'boolean',
      target: 1,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-10-26',
      archived: false,
    }

    // Days 2026-10-26 to 2026-11-04 (10 days total)
    // 5 done days, 1 skipped day, 1 vacation day, 3 missed days
    // Eligible days = 10 - 1 (skipped) - 1 (vacation) = 8 days
    // Done days = 5
    // Consistency = Math.round(5 / 8 * 100) = 63%
    const entries: (Entry & { habit_id: string })[] = [
      { habit_id: 'h1', date: '2026-10-26', value: 1, status: 'done' },
      { habit_id: 'h1', date: '2026-10-27', value: 1, status: 'done' },
      { habit_id: 'h1', date: '2026-10-28', value: 1, status: 'done' },
      { habit_id: 'h1', date: '2026-10-29', value: 1, status: 'done' },
      { habit_id: 'h1', date: '2026-10-30', value: 1, status: 'done' },
      { habit_id: 'h1', date: '2026-10-31', value: 0, status: 'skipped' },
      // 2026-11-01 is a vacation day (no entry)
      // 2026-11-02 missed
      // 2026-11-03 missed
      // 2026-11-04 missed
    ]

    const res = lifetimeStats({
      habits: [habit],
      entries,
      today: '2026-11-04',
      vacations: ['2026-11-01'],
    })

    expect(res.consistency30).toBe(63)
  })

  it('returns null for consistency30 when there are zero eligible days', () => {
    // Habit created tomorrow
    const habit: Habit = {
      id: 'h1',
      name: 'Future habit',
      type: 'boolean',
      target: 1,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-11-05',
      archived: false,
    }

    const res = lifetimeStats({
      habits: [habit],
      entries: [],
      today: '2026-11-04',
    })

    expect(res.consistency30).toBeNull()
  })

  it('calculates daysTracking on the first day as 1', () => {
    const habit: Habit = {
      id: 'h1',
      name: 'Today habit',
      type: 'boolean',
      target: 1,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-11-04',
    }

    const res = lifetimeStats({
      habits: [habit],
      entries: [],
      today: '2026-11-04',
    })

    expect(res.daysTracking).toBe(1)
  })

  it('calculates daysTracking across multiple habits from the earliest created_at', () => {
    const habit1: Habit = {
      id: 'h1',
      name: 'Old habit',
      type: 'boolean',
      target: 1,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-10-05',
    }
    const habit2: Habit = {
      id: 'h2',
      name: 'New habit',
      type: 'boolean',
      target: 1,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-11-01',
    }

    const res = lifetimeStats({
      habits: [habit1, habit2],
      entries: [],
      today: '2026-11-04',
    })

    // 2026-10-05 to 2026-11-04 is 30 days difference, so 31 days inclusive
    expect(res.daysTracking).toBe(31)
  })
})
