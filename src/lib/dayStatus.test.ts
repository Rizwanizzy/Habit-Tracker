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
import type { ScheduleEpoch } from './schedule'

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

  it('isNeutral covers skipped, vacation and unscheduled', () => {
    const all: DayStatus[] = [
      'done',
      'missed',
      'skipped',
      'vacation',
      'before-start',
      'future',
      'unscheduled',
    ]
    expect(all.filter(isNeutral)).toEqual(['skipped', 'vacation', 'unscheduled'])
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

// ── Stage 1: schedule-driven statuses (Habit Scheduling) ─────────────────────
// Reference week: 2026-11-09 (Mon) … 11-15 (Sun); next Monday 11-16.

const schedHabit: Habit = { ...habit, created_at: '2026-11-09' }
const TUE = '2026-11-10'
const SUN = '2026-11-15'
const NEXT_MON = '2026-11-16'
const TODAY = NEXT_MON

const MONDAYS_ONLY: ScheduleEpoch[] = [
  {
    id: 'e1',
    effective_from: '2026-11-09',
    schedule_type: 'weekdays',
    scheduled_days: 1, // Monday only
    interval_days: null,
    weekly_target: null,
  },
]

const WEEKLY_TUE: ScheduleEpoch[] = [
  {
    id: 'e2',
    effective_from: TUE, // starts Tuesday → transition week is neutral
    schedule_type: 'weekly_target',
    scheduled_days: null,
    interval_days: null,
    weekly_target: 3,
  },
]

describe('dayStatus with schedule context (unscheduled)', () => {
  it('a masked-off day is unscheduled; a scheduled day stays missed', () => {
    expect(dayStatus({ habit: schedHabit, date: TUE, entry: undefined, today: TODAY, schedule: MONDAYS_ONLY })).toBe('unscheduled')
    expect(dayStatus({ habit: schedHabit, date: '2026-11-09', entry: undefined, today: TODAY, schedule: MONDAYS_ONLY })).toBe('missed')
  })

  it('done wins over unscheduled', () => {
    const entry: Entry = { date: TUE, value: 1 }
    expect(dayStatus({ habit: schedHabit, date: TUE, entry, today: TODAY, schedule: MONDAYS_ONLY })).toBe('done')
  })

  it('skipped keeps its behaviour on an unscheduled day', () => {
    const entry: Entry = { date: TUE, value: 0, status: 'skipped' }
    expect(dayStatus({ habit: schedHabit, date: TUE, entry, today: TODAY, schedule: MONDAYS_ONLY })).toBe('skipped')
  })

  it('vacation beats unscheduled (vacation stays neutral first)', () => {
    expect(
      dayStatus({
        habit: schedHabit,
        date: TUE,
        entry: undefined,
        today: TODAY,
        vacations: [TUE],
        schedule: MONDAYS_ONLY,
      }),
    ).toBe('vacation')
  })

  it('before-start beats unscheduled', () => {
    expect(
      dayStatus({ habit: schedHabit, date: '2026-11-08', entry: undefined, today: TODAY, schedule: MONDAYS_ONLY }),
    ).toBe('before-start')
  })

  it('future beats unscheduled', () => {
    expect(
      dayStatus({ habit: schedHabit, date: '2026-11-17', entry: undefined, today: TODAY, schedule: MONDAYS_ONLY }),
    ).toBe('future')
  })

  it('a date before the first epoch (but after created_at) is unscheduled', () => {
    const earlyHabit: Habit = { ...habit, created_at: '2026-11-01' }
    expect(
      dayStatus({ habit: earlyHabit, date: '2026-11-08', entry: undefined, today: TODAY, schedule: MONDAYS_ONLY }),
    ).toBe('unscheduled')
  })

  it('a legacy epoch is eligible every day (pre-scheduling behaviour)', () => {
    const legacy: ScheduleEpoch[] = [
      {
        id: 'e3',
        effective_from: '2026-11-09',
        schedule_type: 'legacy',
        scheduled_days: null,
        interval_days: null,
        weekly_target: null,
        legacy_freq_times: 2,
        legacy_freq_days: 7,
      },
    ]
    expect(dayStatus({ habit: schedHabit, date: TUE, entry: undefined, today: TODAY, schedule: legacy })).toBe('missed')
  })

  it('weekly-target transition week (Tue start) is unscheduled until next Monday', () => {
    for (const d of [TUE, '2026-11-11', '2026-11-12', '2026-11-13', SUN]) {
      expect(dayStatus({ habit: schedHabit, date: d, entry: undefined, today: TODAY, schedule: WEEKLY_TUE })).toBe('unscheduled')
    }
    expect(dayStatus({ habit: schedHabit, date: NEXT_MON, entry: undefined, today: TODAY, schedule: WEEKLY_TUE })).toBe('missed')
  })

  it('done still wins inside a neutral transition week', () => {
    const entry: Entry = { date: TUE, value: 1 }
    expect(dayStatus({ habit: schedHabit, date: TUE, entry, today: TODAY, schedule: WEEKLY_TUE })).toBe('done')
  })

  it('a Monday-start weekly target is active immediately (no transition)', () => {
    const weeklyMon: ScheduleEpoch[] = [
      { id: 'e4', effective_from: '2026-11-09', schedule_type: 'weekly_target', scheduled_days: null, interval_days: null, weekly_target: 3 },
    ]
    expect(dayStatus({ habit: schedHabit, date: '2026-11-09', entry: undefined, today: TODAY, schedule: weeklyMon })).toBe('missed')
  })

  it('existing callers without schedule context behave exactly as before', () => {
    // Tuesday with no entry used to be a plain miss — and still is without
    // schedule context (undefined AND an explicitly empty array).
    expect(dayStatus({ habit: schedHabit, date: TUE, entry: undefined, today: TODAY })).toBe('missed')
    expect(dayStatus({ habit: schedHabit, date: TUE, entry: undefined, today: TODAY, schedule: [] })).toBe('missed')
  })

  it('unscheduled is neutral', () => {
    expect(isNeutral('unscheduled')).toBe(true)
  })
})
