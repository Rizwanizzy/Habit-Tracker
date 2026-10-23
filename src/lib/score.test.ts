import { describe, it, expect } from 'vitest'
import { scoreRange, currentStreak, bestStreak, completionRate, isDone } from './score'

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
})