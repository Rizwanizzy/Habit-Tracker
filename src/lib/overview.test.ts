import { describe, expect, it } from 'vitest'
import {
  completionSeries,
  getTop5HabitIds,
  resolveFilterMode,
} from './overview'
import type { ScheduleEpoch } from './schedule'
import type { Entry, Habit } from './score'

function makeHabit(id: string, name: string, created_at = '2026-10-01', sort_order = 1): Habit {
  return {
    id,
    name,
    type: 'boolean',
    target: 1,
    freq_times: 1,
    freq_days: 1,
    created_at,
    sort_order,
  }
}

function ep(over: Partial<ScheduleEpoch>): ScheduleEpoch {
  return {
    id: 'e1',
    effective_from: '2026-11-02',
    schedule_type: 'daily',
    scheduled_days: null,
    interval_days: null,
    weekly_target: null,
    ...over,
  }
}

const done = (date: string): Entry => ({ date, value: 1 })
const missed = (date: string): Entry => ({ date, value: 0 })

describe('completionSeries', () => {
  const habit = makeHabit('h1', 'Read', '2026-10-01')

  it('calculates cumulative completion rate across days', () => {
    const entries: Entry[] = [
      { date: '2026-10-01', value: 1, status: 'done' },
      { date: '2026-10-02', value: 0 }, // missed
      { date: '2026-10-03', value: 1, status: 'done' },
    ]

    const series = completionSeries(habit, entries, '2026-10-01', '2026-10-03', [])
    expect(series).toHaveLength(3)

    // Day 1: 1/1 = 1.0 (100%)
    expect(series[0]).toEqual({ date: '2026-10-01', score: 1 })
    // Day 2: 1/2 = 0.5 (50%)
    expect(series[1]).toEqual({ date: '2026-10-02', score: 0.5 })
    // Day 3: 2/3 ≈ 0.6667
    expect(series[2].date).toBe('2026-10-03')
    expect(series[2].score).toBeCloseTo(2 / 3)
  })

  it('excludes neutral skipped days from denominator', () => {
    const entries: Entry[] = [
      { date: '2026-10-01', value: 1, status: 'done' },
      { date: '2026-10-02', value: 0, status: 'skipped' }, // skipped is neutral
      { date: '2026-10-03', value: 1, status: 'done' },
    ]

    const series = completionSeries(habit, entries, '2026-10-01', '2026-10-03', [])
    // Day 1: 1/1 = 1.0
    expect(series[0].score).toBe(1)
    // Day 2: skipped day is neutral -> still 1/1 = 1.0
    expect(series[1].score).toBe(1)
    // Day 3: 2/2 = 1.0
    expect(series[2].score).toBe(1)
  })

  it('excludes vacation days unless completed', () => {
    const entries: Entry[] = [
      { date: '2026-10-01', value: 1, status: 'done' },
      { date: '2026-10-02', value: 0 }, // on vacation, no entry -> neutral
    ]

    const series = completionSeries(habit, entries, '2026-10-01', '2026-10-02', ['2026-10-02'])
    expect(series[0].score).toBe(1)
    expect(series[1].score).toBe(1) // 2026-10-02 is neutral
  })

  it('handles numeric habit target criteria', () => {
    const numHabit: Habit = {
      id: 'num',
      name: 'Water',
      type: 'numeric',
      target: 2000,
      freq_times: 1,
      freq_days: 1,
      created_at: '2026-10-01',
    }

    const entries: Entry[] = [
      { date: '2026-10-01', value: 2000, status: 'done' }, // meets target -> done
      { date: '2026-10-02', value: 1500 }, // below target -> missed
    ]

    const series = completionSeries(numHabit, entries, '2026-10-01', '2026-10-02', [])
    expect(series[0].score).toBe(1)
    expect(series[1].score).toBe(0.5)
  })

  it('handles zero entries cleanly without NaN', () => {
    const series = completionSeries(habit, [], '2026-10-01', '2026-10-03', [])
    expect(series).toHaveLength(3)
    expect(series[0].score).toBe(0)
    expect(series[1].score).toBe(0)
    expect(series[2].score).toBe(0)
  })

  it('starts series only from created_at date when created mid-range', () => {
    const midHabit = makeHabit('mid', 'Gym', '2026-10-03')
    const series = completionSeries(midHabit, [], '2026-10-01', '2026-10-05', [])
    expect(series[0].date).toBe('2026-10-03')
    expect(series).toHaveLength(3)
  })
})

describe('getTop5HabitIds', () => {
  it('returns all habit IDs when there are 5 or fewer habits', () => {
    const habits = [
      makeHabit('h1', 'H1'),
      makeHabit('h2', 'H2'),
      makeHabit('h3', 'H3'),
    ]
    const metricMap = new Map([
      ['h1', 0.2],
      ['h2', 0.9],
      ['h3', 0.5],
    ])

    const top5 = getTop5HabitIds(habits, metricMap)
    expect(top5.size).toBe(3)
    expect(top5.has('h1')).toBe(true)
    expect(top5.has('h2')).toBe(true)
    expect(top5.has('h3')).toBe(true)
  })

  it('selects the 5 highest scoring habits when there are more than 5', () => {
    const habits = [
      makeHabit('h1', 'H1', '2026-10-01', 1),
      makeHabit('h2', 'H2', '2026-10-01', 2),
      makeHabit('h3', 'H3', '2026-10-01', 3),
      makeHabit('h4', 'H4', '2026-10-01', 4),
      makeHabit('h5', 'H5', '2026-10-01', 5),
      makeHabit('h6', 'H6', '2026-10-01', 6),
      makeHabit('h7', 'H7', '2026-10-01', 7),
    ]

    const metricMap = new Map([
      ['h1', 0.95],
      ['h2', 0.10], // low
      ['h3', 0.85],
      ['h4', 0.75],
      ['h5', 0.65],
      ['h6', 0.55],
      ['h7', 0.05], // lowest
    ])

    const top5 = getTop5HabitIds(habits, metricMap)
    expect(top5.size).toBe(5)
    expect(top5.has('h1')).toBe(true)
    expect(top5.has('h3')).toBe(true)
    expect(top5.has('h4')).toBe(true)
    expect(top5.has('h5')).toBe(true)
    expect(top5.has('h6')).toBe(true)
    expect(top5.has('h2')).toBe(false)
    expect(top5.has('h7')).toBe(false)
  })

  it('breaks ties using established habit ordering', () => {
    const habits = [
      makeHabit('h1', 'H1', '2026-10-01', 1),
      makeHabit('h2', 'H2', '2026-10-01', 2),
      makeHabit('h3', 'H3', '2026-10-01', 3),
      makeHabit('h4', 'H4', '2026-10-01', 4),
      makeHabit('h5', 'H5', '2026-10-01', 5),
      makeHabit('h6', 'H6', '2026-10-01', 6),
    ]

    // All habits have identical 0 score
    const metricMap = new Map<string, number>()
    const top5 = getTop5HabitIds(habits, metricMap)
    expect(top5.size).toBe(5)
    expect(top5.has('h1')).toBe(true)
    expect(top5.has('h2')).toBe(true)
    expect(top5.has('h3')).toBe(true)
    expect(top5.has('h4')).toBe(true)
    expect(top5.has('h5')).toBe(true)
    expect(top5.has('h6')).toBe(false) // 6th in order is excluded
  })
})

describe('resolveFilterMode', () => {
  const habits = [
    makeHabit('h1', 'H1'),
    makeHabit('h2', 'H2'),
    makeHabit('h3', 'H3'),
    makeHabit('h4', 'H4'),
    makeHabit('h5', 'H5'),
    makeHabit('h6', 'H6'),
  ]
  const top5 = new Set(['h1', 'h2', 'h3', 'h4', 'h5'])

  it('identifies all habits selected', () => {
    const visible = new Set(habits.map((h) => h.id))
    expect(resolveFilterMode(habits, visible, top5)).toBe('all')
  })

  it('identifies no habits selected', () => {
    const visible = new Set<string>()
    expect(resolveFilterMode(habits, visible, top5)).toBe('none')
  })

  it('identifies top 5 selected', () => {
    expect(resolveFilterMode(habits, top5, top5)).toBe('top5')
  })

  it('identifies arbitrary manual selection as custom', () => {
    const visible = new Set(['h1', 'h2'])
    expect(resolveFilterMode(habits, visible, top5)).toBe('custom')
  })
})

describe('isolation & filter state transitions', () => {
  const habits = [
    makeHabit('h1', 'H1'),
    makeHabit('h2', 'H2'),
    makeHabit('h3', 'H3'),
    makeHabit('h4', 'H4'),
    makeHabit('h5', 'H5'),
  ]

  it('saves previous selection on isolate and restores it on un-isolate', () => {
    let hidden = new Set(['h3']) // h1, h2, h4, h5 visible
    let isolatedId: string | null = null
    let saved: ReadonlySet<string> | null = null

    // Isolate h2
    if (isolatedId == null) {
      saved = hidden
    }
    hidden = new Set(habits.filter((h) => h.id !== 'h2').map((h) => h.id))
    isolatedId = 'h2'

    expect(isolatedId).toBe('h2')
    expect(hidden.has('h2')).toBe(false)
    expect(hidden.size).toBe(4) // 4 hidden, 1 visible

    // Un-isolate by clicking h2 again
    if (isolatedId === 'h2' && saved != null) {
      hidden = new Set(saved)
      isolatedId = null
      saved = null
    }

    expect(isolatedId).toBeNull()
    expect(hidden.has('h3')).toBe(true)
    expect(hidden.has('h2')).toBe(false)
    expect(hidden.size).toBe(1)
  })

  it('clears isolation when user selects Top 5, All, or None', () => {
    let hidden = new Set(habits.filter((h) => h.id !== 'h1').map((h) => h.id))
    let isolatedId: string | null = 'h1'

    // User clicks All
    isolatedId = null
    hidden = new Set()

    expect(isolatedId).toBeNull()
    expect(hidden.size).toBe(0)
  })
})


// --- Stage 4B: schedule-aware completionSeries (Overview) ----------------------
// Reference weeks (Nov 2026, Monday–Sunday): 02–08, 09–15, 16–22.

describe('Stage 4B completionSeries — daily/weekdays/interval/legacy epochs', () => {
  const habit = makeHabit('h1', 'Read', '2026-11-02')

  it('a daily epoch reproduces the no-epochs series bit-identically', () => {
    const entries = [done('2026-11-02'), missed('2026-11-03'), done('2026-11-04')]
    expect(completionSeries(habit, entries, '2026-11-02', '2026-11-08', [], [ep({})])).toEqual(
      completionSeries(habit, entries, '2026-11-02', '2026-11-08', []),
    )
  })

  it('an explicitly empty epochs array behaves exactly like omitted', () => {
    const entries = [done('2026-11-02'), missed('2026-11-03')]
    expect(completionSeries(habit, entries, '2026-11-02', '2026-11-08', [], [])).toEqual(
      completionSeries(habit, entries, '2026-11-02', '2026-11-08', []),
    )
  })

  it('weekdays: off-days are neutral (not failures); done on an off-day still wins', () => {
    const epochs = [ep({ schedule_type: 'weekdays', scheduled_days: 42 })] // Mon | Wed | Fri
    const entries = [done('2026-11-09'), done('2026-11-11'), missed('2026-11-13')]
    const series = completionSeries(habit, entries, '2026-11-09', '2026-11-15', [], epochs)
    // Mon done → 1/1; Tue off → carry; Wed done → 2/2; Thu off; Fri missed → 2/3.
    expect(series[0].score).toBe(1)
    expect(series[1].score).toBe(1)
    expect(series[2].score).toBe(1)
    expect(series[4].score).toBeCloseTo(2 / 3)
    expect(series[6].score).toBeCloseTo(2 / 3)
    // A done check-in on the masked-off Tuesday counts (done wins).
    const tuesday = completionSeries(habit, [done('2026-11-10')], '2026-11-09', '2026-11-11', [], epochs)
    expect(tuesday[1].score).toBeCloseTo(1 / 2)
  })

  it('interval: off-anchor days are neutral', () => {
    const epochs = [ep({ schedule_type: 'interval', interval_days: 3, effective_from: '2026-11-09' })]
    const entries = [done('2026-11-09'), done('2026-11-12'), missed('2026-11-15')]
    const series = completionSeries(habit, entries, '2026-11-09', '2026-11-15', [], epochs)
    expect(series[0].score).toBe(1)
    expect(series[1].score).toBe(1) // 10 carries
    expect(series[3].score).toBe(1) // 12 done → 2/2
    expect(series[6].score).toBeCloseTo(2 / 3) // 15 missed → 2/3
  })

  it('legacy epochs reproduce the no-epochs series bit-identically', () => {
    const legacy: Habit = { ...habit, freq_times: 2, freq_days: 7 }
    const entries = [done('2026-11-02'), missed('2026-11-03'), done('2026-11-05')]
    expect(
      completionSeries(legacy, entries, '2026-11-02', '2026-11-08', [], [
        ep({ schedule_type: 'legacy', legacy_freq_times: 2, legacy_freq_days: 7 }),
      ]),
    ).toEqual(completionSeries(legacy, entries, '2026-11-02', '2026-11-08', []))
  })

  it('a schedule change mid-range: the daily era counts per day, the weekdays era drops off-days', () => {
    const epochs = [
      ep({ id: 'd1', schedule_type: 'daily', effective_from: '2026-11-01' }),
      ep({ id: 'w2', schedule_type: 'weekdays', scheduled_days: 42, effective_from: '2026-11-09' }),
    ]
    const entries = [done('2026-11-05'), done('2026-11-06'), done('2026-11-09'), done('2026-11-11')]
    const series = completionSeries(habit, entries, '2026-11-05', '2026-11-15', [], epochs)
    // Daily era: 05 done 1/1, 06 done 2/2, 07 missed 2/3, 08 missed 2/4.
    expect(series[0].score).toBe(1)
    expect(series[1].score).toBe(1)
    expect(series[2].score).toBeCloseTo(2 / 3)
    expect(series[3].score).toBeCloseTo(2 / 4)
    // Weekdays era: 09 done 3/5, 10 off → carry, 11 done 4/6, 13 missed 4/7.
    expect(series[4].score).toBeCloseTo(3 / 5)
    expect(series[5].score).toBeCloseTo(3 / 5)
    expect(series[6].score).toBeCloseTo(4 / 6)
    expect(series[8].score).toBeCloseTo(4 / 7)
    expect(series[10].score).toBeCloseTo(4 / 7)
  })
})

describe('Stage 4B completionSeries — weekly_target weeks as opportunities', () => {
  const habit = makeHabit('h1', 'Read', '2026-11-02')
  const epochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2 })]

  it('one opportunity per closed Mon–Sun week; the week containing endDate carries', () => {
    // Week 1 achieved (2 done), week 2 not (1 done), week 3 is the current week.
    const entries = [done('2026-11-02'), done('2026-11-03'), done('2026-11-09')]
    const series = completionSeries(habit, entries, '2026-11-02', '2026-11-22', [], epochs)
    expect(series).toHaveLength(21)
    // Week 1 closes on 11-08 → 1/1 = 100% through its days.
    expect(series[0].score).toBe(1)
    expect(series[6].score).toBe(1)
    // Week 2 closes on 11-15 with 1 of 2 → 50%.
    expect(series[7].score).toBeCloseTo(0.5)
    expect(series[13].score).toBeCloseTo(0.5)
    // Week 3 (11-16..22) contains endDate → never evaluated → carries.
    expect(series[14].score).toBeCloseTo(0.5)
    expect(series[20].score).toBeCloseTo(0.5)
  })

  it('skipped rows never count toward M; vacation-day dones do', () => {
    // Week 2: 1 done + 1 skipped = 1 of 2 → not achieved → rate drops to 1/2.
    const entries: Entry[] = [done('2026-11-02'), done('2026-11-03'), done('2026-11-09'), { date: '2026-11-10', value: 0, status: 'skipped' }]
    const series = completionSeries(habit, entries, '2026-11-02', '2026-11-16', [], epochs)
    expect(series[6].score).toBe(1) // week 1 achieved
    expect(series[13].score).toBeCloseTo(0.5) // week 2 not achieved (skipped never counts)
    // A done entry on a vacation day inside the week counts (done wins).
    const vac = ['2026-11-10']
    const withVac = completionSeries(
      habit,
      [done('2026-11-02'), done('2026-11-03'), done('2026-11-09'), done('2026-11-10')],
      '2026-11-02',
      '2026-11-16',
      vac,
      epochs,
    )
    expect(withVac[13].score).toBe(1)
  })

  it('a transition week (epoch effective Tue–Sun) carries; the first full week scores', () => {
    const tEpochs = [ep({ schedule_type: 'weekly_target', weekly_target: 2, effective_from: '2026-11-11' })]
    const entries = [done('2026-11-16'), done('2026-11-17')]
    const series = completionSeries(habit, entries, '2026-11-02', '2026-11-23', [], tEpochs)
    expect(series).toHaveLength(22)
    // 11-02..10 resolve no epoch → neutral carry; 11-11..15 transition → carry.
    for (let i = 0; i <= 13; i++) expect(series[i].score).toBe(0)
    // Week 16–22 closes before endDate 23 with M dones → 100%.
    expect(series[14].score).toBe(1)
    expect(series[21].score).toBe(1)
  })

  it('a partial week at the window start edge is not scored (scoring-law rule)', () => {
    // Window starts Wednesday of week 1 → that week is only partly covered.
    const entries = [done('2026-11-02'), done('2026-11-03'), done('2026-11-09'), done('2026-11-10')]
    const series = completionSeries(habit, entries, '2026-11-04', '2026-11-15', [], epochs)
    // Week 1: partial at the edge → carry; week 2 contains endDate → carry.
    expect(series[0].score).toBe(0)
    expect(series[11].score).toBe(0)
    // With endDate in the next week, week 2 closes and scores.
    const wider = completionSeries(habit, entries, '2026-11-04', '2026-11-16', [], epochs)
    expect(wider[12].score).toBe(1)
  })

  it('a habit created mid-week: days before created_at are excluded, its partial week carries', () => {
    const satHabit = makeHabit('sat', 'Weekly', '2026-11-14') // Saturday
    const satEpochs = [ep({ schedule_type: 'weekly_target', weekly_target: 4, effective_from: '2026-11-14' })]
    const series = completionSeries(satHabit, [], '2026-11-09', '2026-11-16', [], satEpochs)
    // Points start at created_at (11-14), not at the range start.
    expect(series).toHaveLength(3)
    for (const p of series) expect(p.score).toBe(0)
    // The next full week (16–22) closes on 22 < endDate 23 with M dones → scored.
    const entries = [done('2026-11-16'), done('2026-11-17'), done('2026-11-18'), done('2026-11-19')]
    const next = completionSeries(satHabit, entries, '2026-11-09', '2026-11-23', [], satEpochs)
    expect(next[0].score).toBe(0) // 11-14: partial week carries
    expect(next[1].score).toBe(0) // 11-15: partial week carries
    expect(next[2].score).toBe(1) // 11-16: first full week scored 1/1
    expect(next[8].score).toBe(1)
  })
})
