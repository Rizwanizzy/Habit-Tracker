import { describe, it, expect } from 'vitest'
import { scoreRange, scoreSeries, SMOOTHING_CONSTANT, type Habit, type Entry } from './score'
import type { ScheduleEpoch } from './schedule'

/** The scoring-law step family: 1 − 0.95^k (k = opportunities or the weekly
 *  target M). Matches score.ts's alphaFor bit-for-bit. */
const alpha = (k: number): number => 1 - Math.pow(1 - SMOOTHING_CONSTANT, k)

const habit: Habit = {
  id: 'h1',
  type: 'boolean',
  target: 1,
  freq_times: 1,
  freq_days: 1,
  created_at: '2026-11-01',
}

function ep(over: Partial<ScheduleEpoch>): ScheduleEpoch {
  return {
    id: 'e1',
    effective_from: '2026-11-01',
    schedule_type: 'daily',
    scheduled_days: null,
    interval_days: null,
    weekly_target: null,
    ...over,
  }
}

const done = (date: string): Entry => ({ date, value: 1 })
const missed = (date: string): Entry => ({ date, value: 0 })
const skipped = (date: string): Entry => ({ date, value: 0, status: 'skipped' })

// Reference weeks (Nov 2026, Monday–Sunday): 02–08, 09–15, 16–22, 23–29.
// 11-10 Tue, 11-11 Wed, 11-13 Fri.

describe('Stage 2 scoring law — daily bit-identical compatibility', () => {
  const dailyEpochs = [ep({ schedule_type: 'daily' })]
  const entries: Entry[] = [
    done('2026-11-02'),
    done('2026-11-03'),
    done('2026-11-04'),
    done('2026-11-05'),
    missed('2026-11-06'),
    done('2026-11-07'),
    skipped('2026-11-08'),
  ]
  const vac = ['2026-11-10', '2026-11-11']

  it('scoreRange/scoreSeries with a daily epoch are bit-identical to the no-epochs calls', () => {
    for (const [s, e] of [
      ['2026-11-02', '2026-11-08'],
      ['2026-11-01', '2026-11-14'],
    ] as const) {
      expect(scoreRange(habit, entries, s, e, vac, dailyEpochs)).toBe(
        scoreRange(habit, entries, s, e, vac),
      )
      expect(scoreSeries(habit, entries, s, e, vac, dailyEpochs)).toEqual(
        scoreSeries(habit, entries, s, e, vac),
      )
    }
  })

  it('an explicitly empty epochs array behaves exactly like omitted', () => {
    expect(scoreRange(habit, entries, '2026-11-02', '2026-11-08', vac, [])).toBe(
      scoreRange(habit, entries, '2026-11-02', '2026-11-08', vac),
    )
  })
})

describe('Stage 2 scoring law — fixed schedules step per scheduled opportunity', () => {
  const a = alpha(1)

  it('weekdays: steps only on scheduled days, unscheduled days carry', () => {
    const epochs = [
      ep({ schedule_type: 'weekdays', scheduled_days: 21, effective_from: '2026-11-02' }),
    ] // Mon | Wed | Fri
    const entries = [done('2026-11-09'), done('2026-11-11'), done('2026-11-13')]
    expect(scoreRange(habit, entries, '2026-11-09', '2026-11-15', [], epochs)).toBeCloseTo(
      1 - Math.pow(1 - a, 3),
    )
    const series = scoreSeries(habit, entries, '2026-11-09', '2026-11-15', [], epochs)
    expect(series).toHaveLength(7)
    expect(series[1].score).toBe(series[0].score) // Tue carries
    expect(series[2].score).toBeCloseTo(1 - Math.pow(1 - a, 2)) // Wed steps
    expect(series[3].score).toBe(series[2].score) // Thu carries Wed's score
    expect(series[4].score).toBeCloseTo(1 - Math.pow(1 - a, 3)) // Fri steps
    expect(series[6].score).toBe(series[5].score) // Sat/Sun carry past Fri
  })

  it('a done check-in on an unscheduled day still counts (done wins)', () => {
    const epochs = [
      ep({ schedule_type: 'weekdays', scheduled_days: 21, effective_from: '2026-11-02' }),
    ]
    // Tuesday is masked off; the done check-in steps anyway (09 was a miss).
    expect(
      scoreRange(habit, [done('2026-11-10')], '2026-11-09', '2026-11-10', [], epochs),
    ).toBeCloseTo(a)
  })

  it('a skipped entry on a scheduled day is neutral (carries)', () => {
    const epochs = [
      ep({ schedule_type: 'weekdays', scheduled_days: 21, effective_from: '2026-11-02' }),
    ]
    expect(
      scoreRange(habit, [done('2026-11-09'), skipped('2026-11-11')], '2026-11-09', '2026-11-13', [], epochs),
    ).toBeCloseTo(a)
  })

  it('interval: steps on anchor-aligned days only, off-anchor days carry', () => {
    const epochs = [ep({ schedule_type: 'interval', interval_days: 3, effective_from: '2026-11-09' })]
    const entries = [done('2026-11-09'), done('2026-11-12'), missed('2026-11-15')]
    const s = scoreRange(habit, entries, '2026-11-09', '2026-11-15', [], epochs)
    expect(s).toBeCloseTo((1 - Math.pow(1 - a, 2)) * (1 - a))
    const series = scoreSeries(habit, entries, '2026-11-09', '2026-11-15', [], epochs)
    expect(series).toHaveLength(7)
    for (const i of [1, 2]) expect(series[i].score).toBe(series[0].score) // 10, 11 carry
    expect(series[3].score).toBeCloseTo(1 - Math.pow(1 - a, 2)) // 12 steps
    expect(series[5].score).toBe(series[4].score) // 13, 14 carry past 12
    expect(series[6].score).toBeLessThan(series[5].score) // 15 missed → decays
  })

  it('dates before the first epoch never step (their entries are ignored)', () => {
    const epochs = [ep({ schedule_type: 'daily', effective_from: '2026-11-09' })]
    // 11-01 is before the first epoch — the done entry must not step.
    expect(scoreRange(habit, [done('2026-11-01'), done('2026-11-09')], '2026-11-01', '2026-11-09', [], epochs)).toBeCloseTo(a)
  })
})

describe('Stage 2 scoring law — weekly-target closed weeks', () => {
  const a3 = alpha(3)
  const epochs = [
    ep({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: '2026-11-02' }),
  ]

  it('one step per closed Mon–Sun week; the current week is never scored', () => {
    const entries = [
      done('2026-11-02'), done('2026-11-04'), done('2026-11-06'), // week 1: 3 done → achieved
      done('2026-11-09'), done('2026-11-10'), skipped('2026-11-11'), // week 2: 2 done → failed
      done('2026-11-16'), done('2026-11-18'), done('2026-11-20'), // week 3: current at 11-22
    ]
    // Closed weeks 1–2 scored; week 3 (ends exactly at endDate) is current.
    expect(scoreRange(habit, entries, '2026-11-02', '2026-11-22', [], epochs)).toBeCloseTo(
      a3 * (1 - a3),
    )
    // With endDate in the next week, week 3 is closed and scores too.
    const afterTwo = a3 * (1 - a3)
    expect(scoreRange(habit, entries, '2026-11-02', '2026-11-23', [], epochs)).toBeCloseTo(
      afterTwo + (1 - afterTwo) * a3,
    )
  })

  it('exactly M done achieves the week; M−1 does not; skipped rows never count', () => {
    // Covered by the week pairs above: 3 done → step, 2 done + 1 skipped → fail.
    const entries = [done('2026-11-09'), done('2026-11-10'), skipped('2026-11-11')]
    expect(scoreRange(habit, entries, '2026-11-09', '2026-11-16', [], epochs)).toBe(0)
  })

  it('a done entry on a vacation day inside the week counts (done wins)', () => {
    const vac = ['2026-11-04', '2026-11-05', '2026-11-06']
    const entries = [done('2026-11-02'), done('2026-11-04'), done('2026-11-08')]
    expect(scoreRange(habit, entries, '2026-11-02', '2026-11-09', vac, epochs)).toBeCloseTo(a3)
  })

  it('a partial week at the window edge is not scored', () => {
    // Window starts Wednesday; the Mon-started week is only partially covered.
    const entries = [done('2026-11-02'), done('2026-11-04'), done('2026-11-06')]
    expect(scoreRange(habit, entries, '2026-11-04', '2026-11-08', [], epochs)).toBe(0)
  })
})

describe('Stage 2 scoring law — transition weeks (epoch effective Tue–Sun)', () => {
  const a3 = alpha(3)
  const epochs = [
    ep({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: '2026-11-10' }),
  ] // Tuesday → its start week is neutral

  it('the transition week carries even with M done entries; the next closed week steps', () => {
    const entries = [
      done('2026-11-10'), done('2026-11-11'), done('2026-11-12'), // neutral week → no step
      done('2026-11-16'), done('2026-11-17'), done('2026-11-18'), // week 2 achieved
    ]
    const s = scoreRange(habit, entries, '2026-11-09', '2026-11-29', [], epochs)
    expect(s).toBeCloseTo(a3)
    const series = scoreSeries(habit, entries, '2026-11-09', '2026-11-29', [], epochs)
    expect(series).toHaveLength(21)
    expect(series[6].score).toBe(0) // 11-15: transition week still flat
    expect(series[7].score).toBeCloseTo(a3) // 11-16: the achieved week applied
  })

  it('an epoch effective on Monday is NOT a transition week (scores immediately)', () => {
    const monday = [ep({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: '2026-11-09' })]
    expect(
      scoreRange(habit, [done('2026-11-09'), done('2026-11-11'), done('2026-11-13')], '2026-11-09', '2026-11-16', [], monday),
    ).toBeCloseTo(a3)
  })
})

describe('Stage 2 scoring law — legacy frozen snapshots', () => {
  const legacyHabit: Habit = { ...habit, freq_times: 2, freq_days: 7 }
  const legacyEpochs = [
    ep({ schedule_type: 'legacy', legacy_freq_times: 2, legacy_freq_days: 7 }),
  ]
  const entries: Entry[] = [
    done('2026-11-01'),
    missed('2026-11-02'),
    skipped('2026-11-03'),
    done('2026-11-04'),
    missed('2026-11-05'),
    done('2026-11-06'),
  ]
  const vac = ['2026-11-07']

  it('a legacy epoch reproduces the existing daily EMA bit-identically', () => {
    expect(scoreRange(legacyHabit, entries, '2026-11-01', '2026-11-08', vac, legacyEpochs)).toBe(
      scoreRange(legacyHabit, entries, '2026-11-01', '2026-11-08', vac),
    )
    expect(scoreSeries(legacyHabit, entries, '2026-11-01', '2026-11-08', vac, legacyEpochs)).toEqual(
      scoreSeries(legacyHabit, entries, '2026-11-01', '2026-11-08', vac),
    )
  })

  it('the epoch snapshot (not the habit mirror) drives the legacy alpha', () => {
    const snapshotEpochs = [
      ep({ schedule_type: 'legacy', legacy_freq_times: 1, legacy_freq_days: 2 }),
    ]
    const aHalf = alpha(0.5)
    expect(
      scoreRange(legacyHabit, [done('2026-11-01'), missed('2026-11-02')], '2026-11-01', '2026-11-02', [], snapshotEpochs),
    ).toBeCloseTo(aHalf * (1 - aHalf))
  })
})

describe('Stage 2 scoring law — schedule changes', () => {
  it('daily → weekly across the window: day steps, then the closed week steps', () => {
    const epochs = [
      ep({ id: 'd1', schedule_type: 'daily', effective_from: '2026-11-01' }),
      ep({ id: 'w2', schedule_type: 'weekly_target', weekly_target: 2, effective_from: '2026-11-16' }),
    ]
    const entries = [
      done('2026-11-09'), done('2026-11-10'), done('2026-11-11'), done('2026-11-12'),
      done('2026-11-13'), done('2026-11-14'), done('2026-11-15'), // daily era: 7 ups
      done('2026-11-16'), done('2026-11-17'), missed('2026-11-18'), // week: 2 done = M
    ]
    const a1 = alpha(1)
    const a2 = alpha(2)
    const afterDaily = 1 - Math.pow(1 - a1, 7)
    expect(scoreRange(habit, entries, '2026-11-09', '2026-11-23', [], epochs)).toBeCloseTo(
      afterDaily + (1 - afterDaily) * a2,
    )
  })

  it('a mid-week switch INTO weekly: earlier days walk daily, the transition week is neutral', () => {
    const epochs = [
      ep({ id: 'd1', schedule_type: 'daily', effective_from: '2026-11-01' }),
      ep({ id: 'w2', schedule_type: 'weekly_target', weekly_target: 3, effective_from: '2026-11-10' }),
    ]
    const entries = [done('2026-11-09'), done('2026-11-16'), done('2026-11-17'), done('2026-11-18')]
    const a1 = alpha(1)
    const a3 = alpha(3)
    expect(scoreRange(habit, entries, '2026-11-09', '2026-11-23', [], epochs)).toBeCloseTo(
      a1 + (1 - a1) * a3,
    )
    const series = scoreSeries(habit, entries, '2026-11-09', '2026-11-23', [], epochs)
    for (let i = 1; i <= 6; i++) expect(series[i].score).toBe(series[0].score) // 10–15 carry
  })

  it('a mid-week switch OUT of weekly scores that week under its week-start schedule (documented edge)', () => {
    const epochs = [
      ep({ id: 'w1', schedule_type: 'weekly_target', weekly_target: 2, effective_from: '2026-11-02' }),
      ep({ id: 'd2', schedule_type: 'daily', effective_from: '2026-11-11' }),
    ]
    const entries = [done('2026-11-09'), done('2026-11-12'), done('2026-11-16')]
    const a1 = alpha(1)
    const a2 = alpha(2)
    // Week 09–15 is governed by the weekly epoch at its start (the daily
    // epoch is not weekly_target, so not a transition) → scored as a weekly
    // week; 11-16 steps under the daily epoch.
    expect(scoreRange(habit, entries, '2026-11-09', '2026-11-16', [], epochs)).toBeCloseTo(
      a2 + (1 - a2) * a1,
    )
  })
})
