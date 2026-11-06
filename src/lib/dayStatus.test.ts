import { describe, it, expect } from 'vitest'
import {
  dayStatus,
  isNeutral,
  isEntryDone,
  nextDayAction,
  dayActionFor,
  type DayStatus,
} from './dayStatus'
import type { Entry, Habit } from './score'

const habit: Habit = {
  id: 'h1',
  type: 'boolean',
  target: 1,
  freq_times: 1,
  freq_days: 1,
  created_at: '2026-10-05',
}

const numHabit: Habit = { ...habit, type: 'numeric', target: 10 }

describe('dayStatus', () => {
  it('marks days before the habit start as before-start when there is no entry', () => {
    expect(
      dayStatus({ habit, date: '2026-10-04', entry: undefined, today: '2026-10-10' }),
    ).toBe('before-start')
  })

  it('allows backfilling done entries on days before habit start (done wins)', () => {
    const entry: Entry = { date: '2026-10-04', value: 1 }
    expect(dayStatus({ habit, date: '2026-10-04', entry, today: '2026-10-10' })).toBe('done')
  })

  it('allows backfilling skipped entries on days before habit start', () => {
    const entry: Entry = { date: '2026-10-04', value: 0, status: 'skipped' }
    expect(dayStatus({ habit, date: '2026-10-04', entry, today: '2026-10-10' })).toBe('skipped')
  })

  it('marks future days before done/skipped', () => {
    // A future-but-filled entry (e.g. a stale local row) still counts as future.
    const entry: Entry = { date: '2026-10-11', value: 1 }
    expect(dayStatus({ habit, date: '2026-10-11', entry, today: '2026-10-10' })).toBe('future')
  })

  it('done beats skipped, vacation and missed', () => {
    const entry: Entry = { date: '2026-10-06', value: 1 }
    expect(
      dayStatus({ habit, date: '2026-10-06', entry, today: '2026-10-10', vacations: ['2026-10-06'] }),
    ).toBe('done')
  })

  it('skipped beats vacation and missed', () => {
    const entry: Entry = { date: '2026-10-06', value: 0, status: 'skipped' }
    expect(
      dayStatus({ habit, date: '2026-10-06', entry, today: '2026-10-10', vacations: ['2026-10-06'] }),
    ).toBe('skipped')
  })

  it('vacation beats missed and never shows up on other days', () => {
    expect(
      dayStatus({ habit, date: '2026-10-06', entry: undefined, today: '2026-10-10', vacations: ['2026-10-06'] }),
    ).toBe('vacation')
    expect(
      dayStatus({ habit, date: '2026-10-07', entry: undefined, today: '2026-10-10', vacations: ['2026-10-06'] }),
    ).toBe('missed')
  })

  it('a day with no entry and not on vacation is missed', () => {
    expect(dayStatus({ habit, date: '2026-10-07', entry: undefined, today: '2026-10-10' })).toBe('missed')
  })

  it('a skipped numeric row is never done, never a 0%-miss', () => {
    const skipped: Entry = { date: '2026-10-06', value: 0, status: 'skipped' }
    expect(isEntryDone(numHabit, skipped)).toBe(false)
    expect(
      dayStatus({ habit: numHabit, date: '2026-10-06', entry: skipped, today: '2026-10-10' }),
    ).toBe('skipped')
  })

  it('isNeutral covers exactly skipped and vacation', () => {
    const all: DayStatus[] = ['done', 'missed', 'skipped', 'vacation', 'before-start', 'future']
    expect(all.filter(isNeutral)).toEqual(['skipped', 'vacation'])
  })
})

describe('dayActionFor / nextDayAction (heatmap + tile-menu cycle)', () => {
  it('maps stored rows to cycle states (partial numeric rows are empty)', () => {
    expect(dayActionFor(habit, undefined)).toBe('empty')
    expect(dayActionFor(habit, { date: '2026-10-06', value: 1 })).toBe('done')
    expect(dayActionFor(habit, { date: '2026-10-06', value: 0, status: 'skipped' })).toBe('skipped')
    // Done-but-below-target numeric rows are not done yet (empty), not skipped.
    expect(dayActionFor(numHabit, { date: '2026-10-06', value: 5 })).toBe('empty')
  })

  it('cycles empty → done → skipped → empty', () => {
    expect(nextDayAction('empty')).toBe('done')
    expect(nextDayAction('done')).toBe('skipped')
    expect(nextDayAction('skipped')).toBe('empty')
  })

  it('a full cycle returns to the start', () => {
    expect(nextDayAction(nextDayAction(nextDayAction('empty')))).toBe('empty')
  })
})
