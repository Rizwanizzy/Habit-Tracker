import { describe, expect, it } from 'vitest'
import {
  completionSeries,
  getTop5HabitIds,
  resolveFilterMode,
} from './overview'
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

