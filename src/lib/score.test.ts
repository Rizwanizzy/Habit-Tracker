import { describe, it, expect } from 'vitest'
import { scoreRange, scoreSeries, currentStreak, bestStreak, completionRate, isDone, type Entry } from './score'
import { vacationDatesInRange } from './vacation'
const habit = {
  id: 'h1',
  type: 'boolean' as const,
  target: 1,
  freq_times: 1,
  freq_days: 1,
  created_at: '2026-10-01',
}

describe('score', () => {
  it('miss after a long streak resets current streak', () => {
    const entries = [
      { date: '2026-10-01', value: 1 },
      { date: '2026-10-02', value: 1 },
      { date: '2026-10-03', value: 1 },
      { date: '2026-10-04', value: 0 },
    ]
    expect(currentStreak(habit, entries, '2026-10-04')).toBe(0)
    expect(bestStreak(habit, entries)).toBe(3)
  })

  it('numeric habit below target counts as missed', () => {
    const h = { ...habit, type: 'numeric' as const, target: 10 }
    const entries = [{ date: '2026-10-01', value: 5 }]
    expect(isDone(h, entries[0])).toBe(false)
    expect(completionRate(h, entries, '2026-10-01', '2026-10-01')).toBe(0)
  })

  it('habit created mid-range only counts from created_at', () => {
    const h = { ...habit, created_at: '2026-10-05' }
    const entries = [
      { date: '2026-10-01', value: 1 },
      { date: '2026-10-05', value: 1 },
    ]
    expect(completionRate(h, entries, '2026-10-01', '2026-10-05')).toBe(1)
    expect(scoreRange(h, entries, '2026-10-01', '2026-10-05')).toBeGreaterThan(0)
  })

  it('score handles miss after long streak (decay)', () => {
    const entries: { date: string; value: number }[] = []
    for (let i = 1; i <= 30; i++) {
      const d = `2026-10-${String(i).padStart(2, '0')}`
      entries.push({ date: d, value: 1 })
    }
    entries.push({ date: '2026-10-31', value: 0 })
    const s = scoreRange(habit, entries, '2026-10-01', '2026-10-31')
    expect(s).toBeLessThan(0.99)
    expect(s).toBeGreaterThan(0)
  })

  it('scoreSeries final value matches scoreRange', () => {
    const entries = [
      { date: '2026-10-01', value: 1 },
      { date: '2026-10-02', value: 1 },
      { date: '2026-10-03', value: 0 },
      { date: '2026-10-04', value: 1 },
      { date: '2026-10-05', value: 1 },
    ]
    const series = scoreSeries(habit, entries, '2026-10-01', '2026-10-05')
    expect(series).toHaveLength(5)
    expect(series[series.length - 1].score).toBeCloseTo(
      scoreRange(habit, entries, '2026-10-01', '2026-10-05'),
    )
  })
})

describe('skipped days (entries.status = skipped)', () => {
  it('a skipped day neither counts nor breaks the current streak (neutral)', () => {
    // done(d1), skipped(d2), done(d3) as of d3 → the skipped day is bridged,
    // giving 2 (NOT 3 — neutral days do not count, per the AGENTS.md rule).
    const entries: Entry[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0, status: 'skipped' },
      { date: '2026-10-07', value: 1 },
    ]
    expect(currentStreak(habit, entries, '2026-10-07')).toBe(2)
    expect(bestStreak(habit, entries)).toBe(2)
  })

  it('a missed day still breaks the streak', () => {
    const entries: { date: string; value: number }[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0 },
      { date: '2026-10-07', value: 1 },
    ]
    expect(currentStreak(habit, entries, '2026-10-07')).toBe(1)
  })

  it('a skipped day leaves the score identical to removing that day from the timeline', () => {
    const withSkip: Entry[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0, status: 'skipped' },
      { date: '2026-10-07', value: 1 },
    ]
    // The day removed: 05 and 07 are adjacent days of a shorter timeline.
    const withoutThatDay: Entry[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 1 },
    ]
    expect(scoreRange(habit, withSkip, '2026-10-05', '2026-10-07')).toBe(
      scoreRange(habit, withoutThatDay, '2026-10-05', '2026-10-06'),
    )
    // The series keeps a point for the skipped day but the EMA stands still.
    const series = scoreSeries(habit, withSkip, '2026-10-05', '2026-10-07')
    expect(series[1].score).toBe(series[0].score)
  })

  it('completion rate excludes skipped days from the denominator', () => {
    const entries: Entry[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0, status: 'skipped' },
      { date: '2026-10-07', value: 1 },
    ]
    // 2 done of 2 counted (one skipped removed) → 1, not 2/3.
    expect(completionRate(habit, entries, '2026-10-05', '2026-10-07')).toBe(1)
  })

  it('every day skipped: no NaN and the score stays at its previous value', () => {
    const entries: Entry[] = [
      { date: '2026-10-05', value: 0, status: 'skipped' },
      { date: '2026-10-06', value: 0, status: 'skipped' },
      { date: '2026-10-07', value: 0, status: 'skipped' },
    ]
    expect(currentStreak(habit, entries, '2026-10-07')).toBe(0)
    expect(bestStreak(habit, entries)).toBe(0)
    expect(completionRate(habit, entries, '2026-10-05', '2026-10-07')).toBe(0)
    expect(Number.isNaN(completionRate(habit, entries, '2026-10-05', '2026-10-07'))).toBe(false)
    expect(scoreRange(habit, entries, '2026-10-05', '2026-10-07')).toBe(0)
  })

  it('one explicit done then all skipped: the done score carries over untouched', () => {
    const entries: Entry[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0, status: 'skipped' },
      { date: '2026-10-07', value: 0, status: 'skipped' },
    ]
    expect(scoreRange(habit, entries, '2026-10-05', '2026-10-07')).toBeCloseTo(0.05)
  })

  it('a skipped numeric row is not done', () => {
    const h = { ...habit, type: 'numeric' as const, target: 10 }
    expect(isDone(h, { date: '2026-10-05', value: 0, status: 'skipped' })).toBe(false)
    expect(isDone(h, { date: '2026-10-05', value: 10 })).toBe(true)
  })

  it('regression anchor: a plain done/missed window behaves exactly as before skips existed', () => {
    // weight = 1 - 0.95^1 = 0.05 → after two done days: 0.05 then 0.0975.
    const entries: { date: string; value: number }[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0 },
      { date: '2026-10-07', value: 1 },
    ]
    expect(scoreRange(habit, entries, '2026-10-05', '2026-10-06')).toBeCloseTo(0.05)
    expect(scoreRange(habit, entries, '2026-10-05', '2026-10-07')).toBeCloseTo(
      0.05 + (1 - 0.05) * 0.05,
    )
    // Long window with one miss resets to the same decay as the pre-skip code.
    expect(currentStreak(habit, entries, '2026-10-07')).toBe(1)
    expect(bestStreak(habit, entries)).toBe(1)
    expect(completionRate(habit, entries, '2026-10-05', '2026-10-07')).toBeCloseTo(2 / 3)
  })
})

describe('vacation days (vacation mode, threaded as a date list)', () => {
  // d1..d5 of October 2026; a 3-day vacation lands on d2..d4.
  const VAC = ['2026-10-06', '2026-10-07', '2026-10-08']
  const SESSION: { date: string; value: number }[] = [
    { date: '2026-10-05', value: 1 },
    { date: '2026-10-09', value: 1 },
  ]

  it('done, vacation ×3, done = streak 2 (a vacation day neither counts nor breaks)', () => {
    expect(currentStreak(habit, SESSION, '2026-10-09', VAC)).toBe(2)
    expect(bestStreak(habit, SESSION, VAC)).toBe(2)
  })

  it('a missed day outside the vacation still breaks the streak', () => {
    const entries: { date: string; value: number }[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0 }, // a miss, NOT inside the vacation
      { date: '2026-10-07', value: 1 },
    ]
    expect(currentStreak(habit, entries, '2026-10-07', ['2026-10-09', '2026-10-10'])).toBe(1)
  })

  it('a done entry DURING vacation counts and extends the streak (done wins)', () => {
    const entries: { date: string; value: number }[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 1 }, // checked in during vacation
      { date: '2026-10-09', value: 1 },
    ]
    expect(currentStreak(habit, entries, '2026-10-09', VAC)).toBe(3)
    expect(completionRate(habit, entries, '2026-10-05', '2026-10-09', VAC)).toBe(1)
  })

  it('the score is flat across vacation days and bridges like skips', () => {
    const series = scoreSeries(habit, SESSION, '2026-10-05', '2026-10-09', VAC)
    expect(series[1].score).toBe(series[0].score) // vacation days carry the EMA
    expect(series[2].score).toBe(series[0].score)
    expect(series[3].score).toBe(series[0].score)
    // Identical to the plain timeline with only the two done days counted:
    // vacation days carry the EMA, so d1 and d5 are consecutive steps.
    expect(scoreRange(habit, SESSION, '2026-10-05', '2026-10-09', VAC)).toBeCloseTo(
      0.05 + (1 - 0.05) * 0.05,
    )
  })

  it('an ongoing period covers everything from its start (converted to concrete dates)', () => {
    const dates = vacationDatesInRange(
      [{ id: 'p', start_date: '2026-10-06', end_date: null }],
      '2026-10-05',
      '2026-10-09',
    )
    expect(dates).toEqual(['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
    // d5 and d1 are done, every day in between is forgiven → streak 2.
    expect(currentStreak(habit, SESSION, '2026-10-09', dates)).toBe(2)
    expect(bestStreak(habit, SESSION, dates)).toBe(2)
  })

  it('completion denominator excludes vacation days (all-vacation window → 0, never NaN)', () => {
    expect(completionRate(habit, [], '2026-10-06', '2026-10-08', VAC)).toBe(0)
    // d1 done of 2 counted days (d2–d4 removed) → 1, not 1/4.
    expect(completionRate(habit, SESSION, '2026-10-05', '2026-10-09', VAC)).toBe(1)
  })

  it('no vacations: every output is identical to the no-argument calls (regression)', () => {
    const entries: { date: string; value: number }[] = [
      { date: '2026-10-05', value: 1 },
      { date: '2026-10-06', value: 0 },
      { date: '2026-10-07', value: 1 },
    ]
    expect(currentStreak(habit, entries, '2026-10-07', [])).toBe(currentStreak(habit, entries, '2026-10-07'))
    expect(scoreRange(habit, entries, '2026-10-05', '2026-10-07', [])).toBe(
      scoreRange(habit, entries, '2026-10-05', '2026-10-07'),
    )
    expect(completionRate(habit, entries, '2026-10-05', '2026-10-07', [])).toBe(
      completionRate(habit, entries, '2026-10-05', '2026-10-07'),
    )
  })
})