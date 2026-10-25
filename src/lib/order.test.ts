import { describe, expect, it } from 'vitest'
import { diffOrder, moveHabit, sortHabits, type Orderable } from './order'

function h(id: string, sort_order: number, created_at = '2026-01-01'): Orderable {
  return { id, sort_order, created_at }
}

describe('sortHabits', () => {
  it('sorts by sort_order ascending, then created_at, then id', () => {
    const list = [
      h('c', 1, '2026-03-02'),
      h('a', 1, '2026-01-05'),
      h('b', 0, '2026-06-01'),
      h('d', 1, '2026-01-05'),
    ]
    expect(sortHabits(list).map((x) => x.id)).toEqual(['b', 'a', 'd', 'c'])
  })

  it('treats a missing sort_order as 0 (legacy rows) and does not mutate the input', () => {
    const list: Orderable[] = [
      { id: 'x', sort_order: 3, created_at: '2026-02-01' },
      { id: 'y', created_at: '2025-12-24' },
    ]
    const sorted = sortHabits(list)
    expect(sorted.map((x) => x.id)).toEqual(['y', 'x'])
    expect(list.map((x) => x.id)).toEqual(['x', 'y'])
  })

  it('orders legacy rows where every sort_order is 0 by created_at, then id', () => {
    const list = [
      h('n', 0, '2026-04-01'),
      h('m', 0, '2026-02-01'),
      h('z', 0, '2026-02-01'),
      h('a', 0, '2026-02-01'),
    ]
    expect(sortHabits(list).map((x) => x.id)).toEqual(['a', 'm', 'z', 'n'])
  })
})

describe('moveHabit', () => {
  const list = [h('a', 1), h('b', 2), h('c', 3), h('d', 4)]

  it('moves a habit from first to last', () => {
    expect(moveHabit(list, 'a', 'd').map((x) => x.id)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('moves a habit from last to first', () => {
    expect(moveHabit(list, 'd', 'a').map((x) => x.id)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('moves into the middle by over position', () => {
    expect(moveHabit(list, 'b', 'd').map((x) => x.id)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('returns the same order for a same-position move', () => {
    const same = moveHabit(list, 'b', 'b')
    expect(same.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(diffOrder(list, same)).toEqual([])
  })

  it('returns the same order for unknown active or over ids', () => {
    expect(moveHabit(list, 'nope', 'b')).toBe(list)
    expect(moveHabit(list, 'b', 'nope')).toBe(list)
  })

  it('returns a new array when the order actually changes', () => {
    expect(moveHabit(list, 'a', 'd')).not.toBe(list)
  })
})

describe('diffOrder', () => {
  it('returns [] when nothing moved', () => {
    const list = [h('a', 1), h('b', 2)]
    expect(diffOrder(list, list)).toEqual([])
  })

  it('returns only the changed pairs, numbered from 1 in the new order', () => {
    const before = [h('a', 1), h('b', 2), h('c', 3)]
    const after = moveHabit(before, 'a', 'c')
    expect(diffOrder(before, after)).toEqual([
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
      { id: 'a', sort_order: 3 },
    ])
  })

  it('reports every row for legacy all-zero lists (positions move from 0 to 1..n)', () => {
    const before = [h('a', 0), h('b', 0), h('c', 0)]
    const after = [h('c', 0), h('a', 0), h('b', 0)]
    expect(diffOrder(before, after)).toEqual([
      { id: 'c', sort_order: 1 },
      { id: 'a', sort_order: 2 },
      { id: 'b', sort_order: 3 },
    ])
  })

  it('is empty when the new order equals its own numbering', () => {
    const after = [h('a', 1), h('b', 2)]
    expect(diffOrder(after, after)).toEqual([])
  })
})
