import { describe, expect, it } from 'vitest'
import { todayPair } from './todaySummary'
import type { ScheduleEpoch } from './schedule'
import type { Entry, Habit } from './score'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h',
    user_id: 'u1',
    name: 'Habit',
    type: 'boolean',
    target: 1,
    unit: null,
    freq_times: 1,
    freq_days: 1,
    color: '#3B82F6',
    sort_order: 0,
    archived: false,
    created_at: '2026-01-01',
    ...overrides,
  }
}

function epoch(overrides: Partial<ScheduleEpoch> = {}): ScheduleEpoch {
  return {
    id: 'e1',
    effective_from: '2026-01-01',
    schedule_type: 'daily',
    scheduled_days: null,
    interval_days: null,
    weekly_target: null,
    ...overrides,
  }
}

const entry = (date: string, value = 1, status?: 'done' | 'skipped'): Entry =>
  status ? { date, value, status } : { date, value }

// 2026-01-05 is a Monday; SHOWER = 4x per week, active since 2025-12-01.
const shower = habit({
  id: 'shower',
  name: 'SHOWER',
  schedule_type: 'weekly_target',
  weekly_target: 4,
  created_at: '2025-12-01',
})
const showerEpochs = [
  epoch({ schedule_type: 'weekly_target', weekly_target: 4, effective_from: '2025-12-01' }),
]
const showerEntries = (dates: string[]) => ({ shower: dates.map((d) => entry(d)) })

const run = (habits: Habit[], entries: Record<string, Entry[]>, date: string, vacations: string[] = []) =>
  todayPair({ habits, entriesByHabit: entries, date, vacations, epochsByHabit: { shower: showerEpochs } })

describe('todayPair — non-weekly regression (pre-helper behaviour)', () => {
  it('counts a daily done check-in and a pending missed day', () => {
    const daily = habit({ id: 'daily' })
    expect(run([daily], { daily: [entry('2026-01-06')] }, '2026-01-06')).toEqual({
      done: 1,
      total: 1,
      neutralCount: 0,
      weeklyCounted: 0,
    })
    expect(run([daily], {}, '2026-01-06')).toMatchObject({ done: 0, total: 1 })
  })

  it('excludes skipped days from both sides', () => {
    const daily = habit({ id: 'daily' })
    const pair = run([daily], { daily: [entry('2026-01-06', 0, 'skipped')] }, '2026-01-06')
    expect(pair).toMatchObject({ done: 0, total: 0, neutralCount: 1 })
  })

  it('vacation: unchecked excluded (never a 0% miss), checked counts (done wins)', () => {
    const daily = habit({ id: 'daily' })
    expect(run([daily], {}, '2026-01-06', ['2026-01-06'])).toMatchObject({ total: 0, neutralCount: 1 })
    expect(run([daily], { daily: [entry('2026-01-06')] }, '2026-01-06', ['2026-01-06'])).toMatchObject({
      done: 1,
      total: 1,
    })
  })

  it('counts a numeric habit done only at target', () => {
    const water = habit({ id: 'water', type: 'numeric', target: 5, freq_times: 1, freq_days: 1 })
    expect(run([water], { water: [entry('2026-01-06', 5)] }, '2026-01-06')).toMatchObject({ done: 1 })
    expect(run([water], { water: [entry('2026-01-06', 3)] }, '2026-01-06')).toMatchObject({ done: 0, total: 1 })
  })

  it('before-start habits are excluded from historical totals (approved 2026-11-17)', () => {
    const late = habit({ id: 'late', created_at: '2026-01-10' })
    expect(run([late], {}, '2026-01-06')).toMatchObject({ done: 0, total: 0 })
  })
})

describe('todayPair — weekly-target habits (SHOWER scenario)', () => {
  it('a pending weekly habit sits in the denominator on active-week days', () => {
    // Tuesday, 1/4 done Monday — pending, not done.
    expect(run([shower], showerEntries(['2026-01-05']), '2026-01-06')).toEqual({
      done: 0,
      total: 1,
      neutralCount: 0,
      weeklyCounted: 1,
    })
  })

  it('a check-in today counts as ONE completed habit, not a weekly fraction', () => {
    expect(run([shower], showerEntries(['2026-01-05', '2026-01-06']), '2026-01-06')).toMatchObject({
      done: 1,
      total: 1,
    })
  })

  it('the day the weekly goal is achieved counts as done', () => {
    // 4th check-in lands on Thursday.
    expect(
      run([shower], showerEntries(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']), '2026-01-08'),
    ).toMatchObject({ done: 1, total: 1 })
  })

  it('subsequent days after the goal is reached drop out of the pair', () => {
    expect(
      run([shower], showerEntries(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']), '2026-01-09'),
    ).toEqual({ done: 0, total: 0, neutralCount: 0, weeklyCounted: 0 })
  })

  it('extra check-ins after the goal count (done-wins, approved)', () => {
    const dates = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']
    expect(run([shower], showerEntries(dates), '2026-01-09')).toMatchObject({ done: 1, total: 1 })
  })

  it('undoing the achievement-day check restores pending eligibility', () => {
    // 3/4 after the undo — Friday is pending again.
    expect(run([shower], showerEntries(['2026-01-05', '2026-01-06', '2026-01-07']), '2026-01-09')).toMatchObject({
      done: 0,
      total: 1,
      weeklyCounted: 1,
    })
  })

  it('a transition (partial) week: unchecked excluded (neutral), checked counts', () => {
    // Epoch starts Tuesday 2026-01-06 — its own start week is a transition week.
    const tuesdayEpochs = [epoch({ schedule_type: 'weekly_target', weekly_target: 4, effective_from: '2026-01-06' })]
    const input = { habits: [shower], entriesByHabit: {}, date: '2026-01-07', vacations: [], epochsByHabit: { shower: tuesdayEpochs } }
    expect(todayPair(input)).toEqual({ done: 0, total: 0, neutralCount: 1, weeklyCounted: 0 })
    expect(todayPair({ ...input, entriesByHabit: { shower: [entry('2026-01-07')] } })).toMatchObject({
      done: 1,
      total: 1,
    })
  })

  it('a skipped weekly day is neutral and does not consume weekly budget', () => {
    const input = {
      habits: [shower],
      entriesByHabit: { shower: [entry('2026-01-05'), entry('2026-01-06', 0, 'skipped')] },
      date: '2026-01-06',
      vacations: [],
      epochsByHabit: { shower: showerEpochs },
    }
    expect(todayPair(input)).toEqual({ done: 0, total: 0, neutralCount: 1, weeklyCounted: 0 })
  })

  it('historical dates never leak later check-ins backwards (as-of-that-day)', () => {
    // Viewing Tuesday while Thursday's 4th check already exists: Tuesday was pending.
    const dates = ['2026-01-05', '2026-01-08']
    expect(run([shower], showerEntries(dates), '2026-01-06')).toEqual({
      done: 0,
      total: 1,
      neutralCount: 0,
      weeklyCounted: 1,
    })
    // Monday itself was done (its own check-in).
    expect(run([shower], showerEntries(dates), '2026-01-05')).toMatchObject({ done: 1, total: 1 })
  })
})

describe('todayPair — end-to-end mixing and labels', () => {
  const dailyHabits = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => habit({ id }))

  it('reports the reported SHOWER case under the new rule: check-in moves the pair', () => {
    const entries: Record<string, Entry[]> = {}
    for (const id of ['a', 'b', 'c']) entries[id] = [entry('2026-01-06')]
    // 8 daily habits (3 done) + pending SHOWER → 3/9; after checking SHOWER → 4/9.
    const before = run([...dailyHabits, shower], entries, '2026-01-06')
    expect(before).toMatchObject({ done: 3, total: 9, weeklyCounted: 1 })
    const after = run([...dailyHabits, { ...shower }], { ...entries, shower: [entry('2026-01-06')] }, '2026-01-06')
    expect(after).toMatchObject({ done: 4, total: 9 })
  })

  it('weeklyCounted reports when weekly habits are inside the pair', () => {
    const pair = run([shower], showerEntries(['2026-01-05']), '2026-01-06')
    expect(pair.weeklyCounted).toBe(1)
    const noWeekly = todayPair({
      habits: [habit({ id: 'daily' })],
      entriesByHabit: {},
      date: '2026-01-06',
      epochsByHabit: { shower: showerEpochs },
    })
    expect(noWeekly.weeklyCounted).toBe(0)
  })

  it('an all-neutral day reports every habit in neutralCount', () => {
    const daily = habit({ id: 'daily' })
    const pair = run(
      [daily, shower],
      { daily: [entry('2026-01-06', 0, 'skipped')] },
      '2026-01-06',
      ['2026-01-06'],
    )
    // daily skipped + shower vacation-neutral; shower's vacation day hides it.
    expect(pair).toMatchObject({ done: 0, total: 0, neutralCount: 2 })
  })
})
