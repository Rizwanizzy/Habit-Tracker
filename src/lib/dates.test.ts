import { describe, it, expect } from 'vitest'
import {
  toLocalDateString,
  todayString,
  parseLocalDate,
  addDays,
  daysBetween,
  DAY_START_HOURS,
  isDayStartHour,
  toLogicalDateString,
  logicalToday,
  msUntilNextDayStart,
  formatDayStart,
} from './dates'

describe('dates', () => {
  it('formats a date around midnight in Asia/Kolkata', () => {
    // 2026-10-23 23:30 UTC = 2026-10-24 05:00 IST
    const utc = new Date('2026-10-23T23:30:00Z')
    expect(toLocalDateString(utc)).toBe('2026-10-24')
  })

  it('formats a date just before midnight IST', () => {
    // 2026-10-23 18:00 UTC = 2026-10-23 23:30 IST
    const utc = new Date('2026-10-23T18:00:00Z')
    expect(toLocalDateString(utc)).toBe('2026-10-23')
  })

  it('addDays crosses month boundary', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })

  it('daysBetween computes difference', () => {
    expect(daysBetween('2026-10-01', '2026-10-10')).toBe(9)
  })

  it('todayString returns YYYY-MM-DD', () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('parseLocalDate round trips', () => {
    const d = parseLocalDate('2026-01-15')
    expect(toLocalDateString(d)).toBe('2026-01-15')
  })
})

describe('logical days (day-start setting)', () => {
  it('DAY_START_HOURS lists 0..6 and isDayStartHour validates', () => {
    expect(DAY_START_HOURS).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const h of DAY_START_HOURS) expect(isDayStartHour(h)).toBe(true)
    expect(isDayStartHour(-1)).toBe(false)
    expect(isDayStartHour(7)).toBe(false)
    expect(isDayStartHour(1.5)).toBe(false)
    expect(isDayStartHour('0')).toBe(false)
    expect(isDayStartHour(null)).toBe(false)
  })

  it('toLogicalDateString shifts after-midnight instants to the previous day (day start 4)', () => {
    const shift = 4
    // 01:30 IST on the 28th still belongs to the 27th.
    expect(toLogicalDateString(new Date('2026-10-28T01:30:00+05:30'), shift)).toBe('2026-10-27')
    // Last moment of the previous logical day.
    expect(toLogicalDateString(new Date('2026-10-28T03:59:59+05:30'), shift)).toBe('2026-10-27')
    // The day-start hour itself begins the new logical day.
    expect(toLogicalDateString(new Date('2026-10-28T04:00:00+05:30'), shift)).toBe('2026-10-28')
    // Late evening keeps its own calendar date.
    expect(toLogicalDateString(new Date('2026-10-28T23:59:00+05:30'), shift)).toBe('2026-10-28')
  })

  it('with day start 0 the logical date equals the plain local date (incl. exact midnight)', () => {
    const instants = [
      new Date('2026-10-23T23:30:00Z'), // 2026-10-24 05:00 IST
      new Date('2026-10-23T18:30:00Z'), // exactly 2026-10-24 00:00 IST midnight
      new Date('2026-10-23T18:00:00Z'), // 2026-10-23 23:30 IST
      new Date('2026-01-01T20:15:00Z'), // 2026-01-02 01:45 IST
    ]
    for (const instant of instants) {
      expect(logicalToday(instant, 0)).toBe(toLocalDateString(instant))
    }
  })

  it('crosses month and year boundaries when shifted', () => {
    expect(toLogicalDateString(new Date('2026-01-01T02:00:00+05:30'), 4)).toBe('2025-12-31')
    expect(toLogicalDateString(new Date('2026-03-01T01:00:00+05:30'), 3)).toBe('2026-02-28')
  })

  it('msUntilNextDayStart measures until the next rollover', () => {
    // One second before the 4 AM day start.
    expect(msUntilNextDayStart(new Date('2026-10-28T03:59:59+05:30'), 4)).toBe(1000)
    // At the day start the next rollover is a full day away.
    expect(msUntilNextDayStart(new Date('2026-10-28T04:00:00+05:30'), 4)).toBe(86_400_000)
    // Plain midnight-based day start: 23:00 → 1 hour.
    expect(msUntilNextDayStart(new Date('2026-10-28T23:00:00+05:30'), 0)).toBe(3_600_000)
    // Always positive, even exactly at IST midnight (next change = full day).
    expect(msUntilNextDayStart(new Date('2026-10-23T18:30:00Z'), 0)).toBe(86_400_000)
  })

  it('formatDayStart labels the select options', () => {
    expect(formatDayStart(0)).toBe('12 AM')
    expect(formatDayStart(1)).toBe('1 AM')
    expect(formatDayStart(6)).toBe('6 AM')
  })
})