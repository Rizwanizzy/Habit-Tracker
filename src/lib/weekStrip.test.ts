import { describe, expect, it } from 'vitest'
import { buildWeekStrip, weekStripLabel } from './weekStrip'
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
    created_at: '2025-06-01',
    ...overrides,
  }
}

function epoch(overrides: Partial<ScheduleEpoch> = {}): ScheduleEpoch {
  return {
    id: 'e1',
    effective_from: '2025-06-01',
    schedule_type: 'daily',
    scheduled_days: null,
    interval_days: null,
    weekly_target: null,
    ...overrides,
  }
}

const entry = (date: string, value = 1, status?: 'done' | 'skipped'): Entry =>
  status ? { date, value, status } : { date, value }

// Week of 2026-01-05 (Monday) .. 2026-01-11 (Sunday).
const build = (overrides: Partial<Parameters<typeof buildWeekStrip>[0]> = {}) =>
  buildWeekStrip({
    habits: [habit({ id: 'a' })],
    entriesByHabit: {},
    today: '2026-01-08',
    selectedDate: '2026-01-08',
    epochsByHabit: { a: [epoch()] },
    ...overrides,
  })

describe('buildWeekStrip — Monday/Sunday boundaries', () => {
  it('returns exactly seven cells, Monday first and Sunday last, for a mid-week selection', () => {
    const cells = build({ selectedDate: '2026-01-08' }) // Thursday
    expect(cells).toHaveLength(7)
    expect(cells[0]).toMatchObject({ date: '2026-01-05', weekday: 'Mon' })
    expect(cells[6]).toMatchObject({ date: '2026-01-11', weekday: 'Sun' })
  })

  it('anchors to the same week when the selection is Sunday or Monday', () => {
    for (const selectedDate of ['2026-01-05', '2026-01-11']) {
      const cells = build({ selectedDate })
      expect(cells[0].date).toBe('2026-01-05')
      expect(cells[6].date).toBe('2026-01-11')
    }
  })

  it('moves the whole strip when the selection crosses into the previous week', () => {
    const cells = build({ selectedDate: '2026-01-04' }) // Sunday of the prior week
    expect(cells[0].date).toBe('2025-12-29')
    expect(cells[6].date).toBe('2026-01-04')
  })
})

describe('buildWeekStrip — selection, today and future', () => {
  it('marks exactly the selected date', () => {
    const cells = build({ selectedDate: '2026-01-06' })
    expect(cells.filter((c) => c.selected).map((c) => c.date)).toEqual(['2026-01-06'])
  })

  it('marks the logical today (day-start aware string comparison)', () => {
    const cells = build({ today: '2026-01-07', selectedDate: '2026-01-05' })
    expect(cells.find((c) => c.isToday)?.date).toBe('2026-01-07')
  })

  it('future cells are flagged and carry NO completion values (never display future values)', () => {
    const cells = build({ today: '2026-01-08' })
    expect(cells.filter((c) => c.future).map((c) => c.date)).toEqual(['2026-01-09', '2026-01-10', '2026-01-11'])
    for (const cell of cells.filter((c) => c.future)) {
      expect(cell).toMatchObject({ done: 0, total: 0, fraction: 0, neutral: false, paused: false })
    }
  })

  it('has no future cells when today is the Sunday of the week', () => {
    const cells = build({ today: '2026-01-11', selectedDate: '2026-01-11' })
    expect(cells.every((c) => !c.future)).toBe(true)
  })
})

describe('buildWeekStrip — completion indicator (reuses todayPair)', () => {
  it('fraction and done/total come straight from todayPair for past days', () => {
    const cells = build({
      habits: [habit({ id: 'a' }), habit({ id: 'b' }), habit({ id: 'c' }), habit({ id: 'd' })],
      entriesByHabit: { a: [entry('2026-01-05')] },
      epochsByHabit: { a: [epoch()], b: [epoch()], c: [epoch()], d: [epoch()] },
      selectedDate: '2026-01-05',
      today: '2026-01-05',
    })
    const monday = cells[0]
    expect(monday).toMatchObject({ done: 1, total: 4, fraction: 0.25 })
  })

  it('weekly-target habit: pending day sits in the denominator; achievement day counts; post-goal days drop out', () => {
    const shower = habit({
      id: 'shower',
      schedule_type: 'weekly_target',
      weekly_target: 4,
      created_at: '2025-06-01',
    })
    const epochs = { shower: [epoch({ schedule_type: 'weekly_target', weekly_target: 4 })] }
    const entriesByHabit = {
      shower: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'].map((d) => entry(d)),
    }
    const cells = build({ habits: [shower], entriesByHabit, epochsByHabit: epochs, today: '2026-01-09' })
    expect(cells[0]).toMatchObject({ date: '2026-01-05', done: 1, total: 1, fraction: 1 })
    expect(cells[4]).toMatchObject({ date: '2026-01-09', done: 0, total: 0, neutral: true, fraction: 0 })
  })

  it('weekly-target habit: an extra post-goal check-in still counts (done-wins)', () => {
    const shower = habit({ id: 'shower', schedule_type: 'weekly_target', weekly_target: 4, created_at: '2025-06-01' })
    const epochs = { shower: [epoch({ schedule_type: 'weekly_target', weekly_target: 4 })] }
    const entriesByHabit = {
      shower: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'].map((d) => entry(d)),
    }
    const cells = build({ habits: [shower], entriesByHabit, epochsByHabit: epochs, today: '2026-01-09' })
    expect(cells[4]).toMatchObject({ date: '2026-01-09', done: 1, total: 1, fraction: 1 })
  })

  it('a skipped day is neutral in its cell (not a 0% miss)', () => {
    const cells = build({
      entriesByHabit: { a: [entry('2026-01-06', 0, 'skipped')] },
      selectedDate: '2026-01-06',
    })
    expect(cells[1]).toMatchObject({ date: '2026-01-06', paused: false, neutral: true, done: 0, total: 0 })
  })

  it('a day before every habit starts is neutral (before-start era)', () => {
    const cells = build({
      habits: [habit({ id: 'a', created_at: '2026-01-10' })],
      epochsByHabit: { a: [epoch({ effective_from: '2026-01-10' })] },
    })
    expect(cells[0]).toMatchObject({ date: '2026-01-05', neutral: true, total: 0 })
  })
})

describe('buildWeekStrip — vacation (paused) cells', () => {
  it('an unchecked vacation day is paused, not a 0% miss', () => {
    const cells = build({ vacations: ['2026-01-06'], selectedDate: '2026-01-06' })
    expect(cells[1]).toMatchObject({ date: '2026-01-06', vacation: true, paused: true, total: 0, fraction: 0 })
  })

  it('a check-in on a vacation day counts (done wins) — progress renders, not paused', () => {
    const cells = build({
      vacations: ['2026-01-06'],
      entriesByHabit: { a: [entry('2026-01-06')] },
      selectedDate: '2026-01-06',
    })
    expect(cells[1]).toMatchObject({ date: '2026-01-06', vacation: true, paused: false, done: 1, total: 1, fraction: 1 })
  })

  it('only the vacation dates themselves are paused', () => {
    const cells = build({ vacations: ['2026-01-05', '2026-01-06'] })
    expect(cells.filter((c) => c.paused).map((c) => c.date)).toEqual(['2026-01-05', '2026-01-06'])
  })
})

describe('weekStripLabel — accessibility labels', () => {
  it('includes weekday, month day and the done/total progress', () => {
    const cells = build({
      habits: [habit({ id: 'a' }), habit({ id: 'b' }), habit({ id: 'c' }), habit({ id: 'd' })],
      entriesByHabit: { a: [entry('2026-01-05')] },
      epochsByHabit: { a: [epoch()], b: [epoch()], c: [epoch()], d: [epoch()] },
    })
    expect(weekStripLabel(cells[0])).toBe('Mon, Jan 5 · 1 of 4 done')
  })

  it('labels future, paused, neutral and vacation-with-done days distinctly', () => {
    const cells = build({
      vacations: ['2026-01-06'],
      entriesByHabit: { a: [entry('2026-01-07', 0, 'skipped')] },
    })
    expect(weekStripLabel(cells[4])).toContain('future')
    expect(weekStripLabel(cells[1])).toBe('Tue, Jan 6 · vacation, habits paused')
    expect(weekStripLabel(cells[2])).toBe('Wed, Jan 7 · nothing scheduled')
    const withDone = build({
      vacations: ['2026-01-06'],
      entriesByHabit: { a: [entry('2026-01-06')] },
    })
    expect(weekStripLabel(withDone[1])).toBe('Tue, Jan 6 · vacation · 1 of 1 done')
  })
})
