import { describe, expect, it } from 'vitest'
import {
  completionForDates,
  dayCompletion,
  intensityPct,
  monthCalendar,
  sparseMonthLabels,
  yearCalendar,
  yearMonthLabels,
} from './completion'
import type { Entry, Habit } from './score'

function habit(created_at: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id: created_at,
    user_id: 'u1',
    name: created_at,
    type: 'boolean',
    target: 1,
    unit: null,
    freq_times: 1,
    freq_days: 1,
    color: '#3B82F6',
    sort_order: 0,
    archived: false,
    created_at,
    ...overrides,
  }
}

describe('dayCompletion', () => {
  it('counts only habits that already exist and are done', () => {
    const habits = [habit('2025-08-01'), habit('2025-08-05')]
    const entries: Record<string, Entry[]> = {
      '2025-08-01': [{ date: '2025-08-10', value: 1 }],
    }
    // Only the first habit is eligible on Aug 10 (the second starts Aug 5 → eligible too? created_at 05 <= 10 → yes, both eligible).
    expect(dayCompletion(habits, entries, '2025-08-10')).toEqual({
      date: '2025-08-10',
      eligible: 2,
      done: 1,
      frac: 0.5,
    })
  })

  it('gives frac 0 when nothing is eligible yet', () => {
    expect(dayCompletion([habit('2025-08-05')], {}, '2025-08-01')).toEqual({
      date: '2025-08-01',
      eligible: 0,
      done: 0,
      frac: 0,
    })
  })

  it('treats numeric habits below target as not done', () => {
    const h = habit('2025-01-01', { type: 'numeric', target: 10, unit: 'min' })
    const entries = { [h.id]: [{ date: '2025-01-02', value: 5 }] }
    expect(dayCompletion([h], entries, '2025-01-02')).toMatchObject({ done: 0, frac: 0 })
    const full = { [h.id]: [{ date: '2025-01-02', value: 10 }] }
    expect(dayCompletion([h], full, '2025-01-02')).toMatchObject({ done: 1, frac: 1 })
  })
})

describe('completionForDates', () => {
  it('preserves input order', () => {
    const h = habit('2025-01-01')
    const dates = ['2025-01-03', '2025-01-01']
    const out = completionForDates([h], {}, dates)
    expect(out.map((d) => d.date)).toEqual(dates)
  })
})

describe('intensityPct', () => {
  it('returns 0 for the neutral track', () => {
    expect(intensityPct(0)).toBe(0)
    expect(intensityPct(-1)).toBe(0)
  })

  it('scales up with completion and caps at 100', () => {
    expect(intensityPct(1)).toBe(100)
    expect(intensityPct(0.5)).toBe(Math.round(20 + 0.5 * 80))
    expect(intensityPct(0.25)).toBeGreaterThan(intensityPct(0.1))
  })
})

describe('monthCalendar', () => {
  it('shapes August 2025 (Fri start, 31 days → 6 weeks)', () => {
    const weeks = monthCalendar('2025-08-15')
    expect(weeks).toHaveLength(6)
    expect(weeks[0][0]).toBeNull()
    expect(weeks[0][5]).toBe('2025-08-01')
    expect(weeks[0][6]).toBe('2025-08-02')
    expect(weeks.at(-1)![0]).toBe('2025-08-31')
    expect(weeks.at(-1)![1]).toBeNull()
  })

  it('handles a month that fits exactly (Feb 2026 starts Sunday, 28 days → 4 weeks)', () => {
    const weeks = monthCalendar('2026-02-01')
    expect(weeks[0][0]).toBe('2026-02-01')
    expect(weeks.at(-1)![6]).toBe('2026-02-28')
  })
})

describe('sparseMonthLabels', () => {
  it('drops the sliver month when two months start one column apart', () => {
    // December owns a 1-column sliver, January runs to Feb.
    const labels = [
      { col: 0, text: 'Dec' },
      { col: 1, text: 'Jan' },
      { col: 5, text: 'Feb' },
    ]
    const out = sparseMonthLabels(labels)
    expect(out.map((l) => l.text)).toEqual(['Jan', 'Feb'])
  })

  it('keeps both labels when they have room', () => {
    const labels = [
      { col: 0, text: 'Jan' },
      { col: 4, text: 'Feb' },
    ]
    expect(sparseMonthLabels(labels)).toEqual(labels)
  })

  it('handles empty and single-label input', () => {
    expect(sparseMonthLabels([])).toEqual([])
    expect(sparseMonthLabels([{ col: 2, text: 'Mar' }])).toEqual([{ col: 2, text: 'Mar' }])
  })
})

describe('yearCalendar', () => {
  it('windows to the trailing 10 months (oldest 1st → current week)', () => {
    const today = '2026-10-26' // Monday
    const cols = yearCalendar(today)
    // Trailing 10 months: Jan 1 2026 (Thu) → Sunday start 2025-12-28 …
    expect(cols[0][0]).toBe('2025-12-28')
    expect(new Date(cols[0][0]).getDay()).toBe(0)
    // …and ends the week containing today.
    expect(cols.at(-1)).toContain(today)
    // Every column is 7 days and rows stay Sunday-aligned.
    expect(cols.every((c) => c.length === 7)).toBe(true)
    expect(cols.every((c, i) => (i === 0 ? true : new Date(c[0]).getDay() === 0))).toBe(true)
    // ~44 weeks, not a full year.
    expect(cols.length).toBeGreaterThanOrEqual(42)
    expect(cols.length).toBeLessThanOrEqual(46)
  })

  it('labels cover the whole window and stay in range', () => {
    const cols = yearCalendar('2026-10-26')
    const labels = yearMonthLabels(cols)
    expect(labels.length).toBeGreaterThanOrEqual(10)
    // The December sliver (1 column) gets thinned, so the first visible
    // label is January at its own column.
    expect(labels[0]).toEqual({ col: 1, text: 'Jan' })
    expect(labels.every(({ col }) => col >= 0 && col < cols.length)).toBe(true)
  })
})
