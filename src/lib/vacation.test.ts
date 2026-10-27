import { describe, expect, it } from 'vitest'
import {
  isVacationDay,
  sortPeriods,
  validatePeriod,
  vacationDatesInRange,
  type VacationPeriod,
} from './vacation'

const P = (id: string, start: string, end: string | null, created_at = `2020-01-01`): VacationPeriod => ({
  id,
  start_date: start,
  end_date: end,
  created_at,
})

describe('isVacationDay', () => {
  const periods = [P('a', '2026-10-12', '2026-10-18'), P('b', '2026-10-25', null)]

  it('covers the inclusive range, not the day before or after', () => {
    expect(isVacationDay('2026-10-12', periods)).toBe(true)
    expect(isVacationDay('2026-10-18', periods)).toBe(true)
    expect(isVacationDay('2026-10-11', periods)).toBe(false)
    expect(isVacationDay('2026-10-19', periods)).toBe(false)
  })

  it('an ongoing period covers every date from its start onward', () => {
    expect(isVacationDay('2026-10-25', periods)).toBe(true)
    expect(isVacationDay('2027-05-01', periods)).toBe(true)
    expect(isVacationDay('2026-10-24', periods)).toBe(false)
  })

  it('crosses month and year boundaries', () => {
    const cross = [P('c', '2025-12-29', '2026-01-02')]
    expect(isVacationDay('2025-12-31', cross)).toBe(true)
    expect(isVacationDay('2026-01-01', cross)).toBe(true)
    expect(isVacationDay('2026-01-03', cross)).toBe(false)
  })

  it('is false for no periods', () => {
    expect(isVacationDay('2026-10-12', [])).toBe(false)
  })
})

describe('validatePeriod', () => {
  const existing = [P('a', '2026-10-12', '2026-10-18'), P('b', '2026-10-25', null)]

  it('accepts a valid finite period and adjacent days', () => {
    expect(validatePeriod(existing, { start_date: '2026-09-01', end_date: '2026-09-10' })).toEqual([])
    // Adjacent (no overlap): the day after one period ends is fine.
    expect(validatePeriod(existing, { start_date: '2026-10-19', end_date: '2026-10-20' })).toEqual([])
  })

  it('rejects an end before the start', () => {
    expect(validatePeriod([], { start_date: '2026-10-18', end_date: '2026-10-12' })).toEqual([
      'The end date cannot be before the start date.',
    ])
    // Same day is a valid single-day break.
    expect(validatePeriod([], { start_date: '2026-10-18', end_date: '2026-10-18' })).toEqual([])
  })

  it('rejects malformed calendar dates (2026-02-30)', () => {
    expect(validatePeriod([], { start_date: '2026-02-30', end_date: null })).toEqual([
      'The start date is not a valid date.',
    ])
    expect(validatePeriod([], { start_date: '2026-10-01', end_date: 'not-a-date' })).toEqual([
      'The end date is not a valid date.',
    ])
  })

  it('rejects any overlap: partial, contained and surrounding', () => {
    expect(validatePeriod(existing, { start_date: '2026-10-15', end_date: '2026-10-20' }).join(' ')).toContain('overlaps')
    expect(validatePeriod(existing, { start_date: '2026-10-13', end_date: '2026-10-14' }).join(' ')).toContain('overlaps')
    // A candidate that surrounds a shorter existing period still overlaps it.
    expect(validatePeriod(existing, { start_date: '2026-10-01', end_date: '2026-10-30' }).join(' ')).toContain('overlaps')
    expect(validatePeriod(existing, { start_date: '2026-10-01', end_date: null }).join(' ')).toContain('overlaps')
  })

  it('allows at most one ongoing period', () => {
    // Before the ongoing start (no overlap) but still a second ongoing.
    const errs = validatePeriod(existing, { start_date: '2026-09-01', end_date: null })
    expect(errs.join(' ')).toContain('Only one break can be ongoing.')
    expect(validatePeriod([], { start_date: '2026-09-01', end_date: null })).toEqual([])
  })
})

describe('sortPeriods', () => {
  it('sorts by start_date, then created_at, then id, without mutating', () => {
    const input = [P('z', '2026-10-20', null, '2026-10-01'), P('a', '2026-10-10', '2026-10-12', '2026-10-02'), P('m', '2026-10-10', '2026-10-12', '2026-10-01')]
    const sorted = sortPeriods(input)
    expect(sorted.map((p) => p.id)).toEqual(['m', 'a', 'z'])
    expect(input[0].id).toBe('z') // input untouched
  })

  it('sorts an ongoing period purely by its start', () => {
    const sorted = sortPeriods([P('b', '2026-11-01', null), P('a', '2026-10-01', null)])
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('vacationDatesInRange', () => {
  const periods = [P('a', '2026-10-12', '2026-10-18'), P('b', '2026-10-25', null)]

  it('lists every covered date, clipped to the asked range', () => {
    expect(vacationDatesInRange(periods, '2026-10-14', '2026-10-16')).toEqual(['2026-10-14', '2026-10-15', '2026-10-16'])
    // Ongoing clips at the range end (its start is 10-25), never explodes.
    expect(vacationDatesInRange(periods, '2026-10-24', '2026-10-26')).toEqual(['2026-10-25', '2026-10-26'])
  })

  it('is empty when nothing overlaps, sorted and deduped otherwise', () => {
    expect(vacationDatesInRange(periods, '2026-01-01', '2026-01-31')).toEqual([])
    const wide = vacationDatesInRange([P('x', '2026-10-01', '2026-10-03'), P('y', '2026-10-03', '2026-10-04')], '2026-10-01', '2026-10-30')
    expect(wide).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  })

  it('handles no periods', () => {
    expect(vacationDatesInRange([], '2026-10-01', '2026-10-30')).toEqual([])
  })
})
