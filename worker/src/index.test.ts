/**
 * Due-time matching tests for the daily-reminder Worker.
 *
 * `isDue` is a pure minute-of-day comparison. These tests guard the
 * midnight-wrap fix: reminder times near midnight (23:46-23:59) were
 * permanently missed because the dispatch window crossed 00:00 but `now`
 * wraps back to 0.
 */
import { describe, expect, it } from 'vitest'
import { isDue } from './index'

describe('isDue — midnight wrap', () => {
  // Reminder 23:45: window [23:45, 00:00) — ends exactly at midnight, no wrap.
  it('fires at the due minute for 23:45', () => {
    expect(isDue('23:45', '23:45')).toBe(true)
  })
  it('fires in the 15-minute window after 23:45', () => {
    expect(isDue('23:50', '23:45')).toBe(true)
    expect(isDue('23:59', '23:45')).toBe(true)
  })
  it('does not fire after the 23:45 window ends at 00:00', () => {
    expect(isDue('00:00', '23:45')).toBe(false)
    expect(isDue('00:04', '23:45')).toBe(false)
  })
  it('does not fire before the 23:45 window opens', () => {
    expect(isDue('23:44', '23:45')).toBe(false)
  })

  // Reminder 23:50: window [23:50, 00:05) — crosses midnight.
  it('fires at the due minute for 23:50', () => {
    expect(isDue('23:50', '23:50')).toBe(true)
  })
  it('fires in the pre-midnight tail of a 23:50 reminder', () => {
    expect(isDue('23:55', '23:50')).toBe(true)
    expect(isDue('23:59', '23:50')).toBe(true)
  })
  it('fires in the post-midnight tail of a 23:50 reminder (wrap)', () => {
    expect(isDue('00:00', '23:50')).toBe(true)
    expect(isDue('00:04', '23:50')).toBe(true)
  })
  it('does not fire once a 23:50 reminder window has fully passed', () => {
    expect(isDue('00:05', '23:50')).toBe(false)
    expect(isDue('00:14', '23:50')).toBe(false)
  })
  it('does not fire before a 23:50 reminder window opens', () => {
    expect(isDue('23:45', '23:50')).toBe(false)
    expect(isDue('23:49', '23:50')).toBe(false)
  })

  // Reminder 23:59: window [23:59, 00:13) — crosses midnight.
  it('fires at the due minute for 23:59', () => {
    expect(isDue('23:59', '23:59')).toBe(true)
  })
  it('fires in the post-midnight tail of a 23:59 reminder (wrap)', () => {
    expect(isDue('00:00', '23:59')).toBe(true)
    expect(isDue('00:13', '23:59')).toBe(true)
  })
  it('does not fire once a 23:59 reminder window has fully passed', () => {
    expect(isDue('00:14', '23:59')).toBe(false)
  })
  it('does not fire before a 23:59 reminder window opens', () => {
    expect(isDue('23:58', '23:59')).toBe(false)
  })

  // Reminder 00:00: window [00:00, 00:15).
  it('fires at the due minute for 00:00', () => {
    expect(isDue('00:00', '00:00')).toBe(true)
  })
  it('fires in the 15-minute window after 00:00', () => {
    expect(isDue('00:07', '00:00')).toBe(true)
    expect(isDue('00:14', '00:00')).toBe(true)
  })
  it('does not fire once the 00:00 window ends at 00:15', () => {
    expect(isDue('00:15', '00:00')).toBe(false)
  })
  it('does not fire before the 00:00 window opens', () => {
    expect(isDue('23:59', '00:00')).toBe(false)
  })

  // Reminder 00:05: window [00:05, 00:20).
  it('fires at the due minute for 00:05', () => {
    expect(isDue('00:05', '00:05')).toBe(true)
  })
  it('fires in the 15-minute window after 00:05', () => {
    expect(isDue('00:19', '00:05')).toBe(true)
  })
  it('does not fire before the 00:05 window opens', () => {
    expect(isDue('00:04', '00:05')).toBe(false)
  })
  it('does not fire once the 00:05 window ends at 00:20', () => {
    expect(isDue('00:20', '00:05')).toBe(false)
  })

  // Normal daytime reminders must be bit-identical to the previous behaviour.
  it('fires for a normal daytime reminder (20:00)', () => {
    expect(isDue('20:00', '20:00')).toBe(true)
    expect(isDue('20:14', '20:00')).toBe(true)
  })
  it('does not fire outside a normal daytime window', () => {
    expect(isDue('19:59', '20:00')).toBe(false)
    expect(isDue('20:15', '20:00')).toBe(false)
  })

  it('returns false when no reminder time is configured', () => {
    expect(isDue('20:00', undefined)).toBe(false)
    expect(isDue('20:00', '')).toBe(false)
  })

  it('is consistent with minute-of-day arithmetic across the whole day', () => {
    // Spot-check every hour boundary: a reminder at HH:00 should fire from HH:00 to HH:14.
    for (let h = 0; h < 24; h += 1) {
      const hh = String(h).padStart(2, '0')
      expect(isDue(`${hh}:00`, `${hh}:00`)).toBe(true)
      expect(isDue(`${hh}:14`, `${hh}:00`)).toBe(true)
      expect(isDue(`${hh}:15`, `${hh}:00`)).toBe(false)
    }
  })
})
