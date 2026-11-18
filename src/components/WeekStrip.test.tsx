import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WeekStrip } from './WeekStrip'
import { buildWeekStrip } from '../lib/weekStrip'
import type { ScheduleEpoch } from '../lib/schedule'
import type { Entry, Habit } from '../lib/score'

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
    emoji: null,
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

// Week of 2026-01-05 (Monday) .. 2026-01-11 (Sunday); logical today Jan 8.
const build = (overrides: Partial<Parameters<typeof buildWeekStrip>[0]> = {}) =>
  buildWeekStrip({
    habits: [habit({ id: 'a' })],
    entriesByHabit: {},
    today: '2026-01-08',
    selectedDate: '2026-01-08',
    epochsByHabit: { a: [epoch()] },
    ...overrides,
  })

const noop = () => {}

describe('WeekStrip — accessible date-selection semantics (D-2)', () => {
  it('renders one button per day with roving tabindex (exactly one tab stop)', () => {
    const cells = build({ selectedDate: '2026-01-06' }) // Tuesday selected
    const html = renderToStaticMarkup(<WeekStrip cells={cells} onSelect={noop} />)
    expect((html.match(/<button/g) || [])).toHaveLength(7)
    // The selected (non-future) day is the roving tab stop.
    expect((html.match(/tabindex="0"/g) || [])).toHaveLength(1)
    expect((html.match(/tabindex="-1"/g) || [])).toHaveLength(6)
  })

  it('disables future-day buttons so they cannot be selected', () => {
    const cells = build({ today: '2026-01-08' }) // Thu–Sun are future
    const html = renderToStaticMarkup(<WeekStrip cells={cells} onSelect={noop} />)
    const disabled = (html.match(/disabled/g) || []).length
    // Today Jan 8 is a Thursday, so Fri/Sat/Sun (3 days) are future.
    expect(disabled).toBe(3)
  })

  it('marks the logical today with aria-current="date"', () => {
    const cells = build({ today: '2026-01-07', selectedDate: '2026-01-05' })
    const html = renderToStaticMarkup(<WeekStrip cells={cells} onSelect={noop} />)
    expect(html).toContain('aria-current="date"')
  })

  it('announces the selected day in its accessible label (D-2)', () => {
    const cells = build({ selectedDate: '2026-01-06' })
    const html = renderToStaticMarkup(<WeekStrip cells={cells} onSelect={noop} />)
    expect(html).toContain('Tue, Jan 6')
    expect(html).toContain(', selected')
  })

  it('does not use aria-pressed: date selection is single-select, not a toggle (D-2)', () => {
    const cells = build({ selectedDate: '2026-01-06' })
    const html = renderToStaticMarkup(<WeekStrip cells={cells} onSelect={noop} />)
    expect(html).not.toContain('aria-pressed')
  })
})

describe('WeekStrip — completion cells reuse todayPair (no competing calculation)', () => {
  it('exposes done/total/fraction for past days', () => {
    const cells = build({
      habits: [habit({ id: 'a' }), habit({ id: 'b' }), habit({ id: 'c' }), habit({ id: 'd' })],
      entriesByHabit: { a: [entry('2026-01-05')] },
      epochsByHabit: { a: [epoch()], b: [epoch()], c: [epoch()], d: [epoch()] },
      selectedDate: '2026-01-05',
      today: '2026-01-05',
    })
    expect(cells[0]).toMatchObject({ date: '2026-01-05', done: 1, total: 4, fraction: 0.25 })
  })

  it('a skipped day is neutral, not a 0% miss', () => {
    const cells = build({
      entriesByHabit: { a: [entry('2026-01-06', 0, 'skipped')] },
      selectedDate: '2026-01-06',
    })
    expect(cells[1]).toMatchObject({ date: '2026-01-06', neutral: true, done: 0, total: 0 })
  })
})
