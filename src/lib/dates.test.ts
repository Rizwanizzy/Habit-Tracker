import { describe, it, expect } from 'vitest'
import { toLocalDateString, todayString, parseLocalDate, addDays, daysBetween } from './dates'

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