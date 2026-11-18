import { describe, expect, it } from 'vitest'
import {
  buildHabitMatrix,
  matrixCaption,
  matrixCellAction,
  matrixCellLabel,
  matrixNameKeyAction,
  numericCellDisplayValue,
  numericCellProgress,
  revealColumnScroll,
  MATRIX_STATE_LABEL,
  type MatrixCell,
} from './habitMatrix'
import type { ScheduleEpoch } from './schedule'
import type { Entry, Habit } from './score'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h',
    user_id: 'u1',
    name: 'Habit',
    type: 'boolean',
    target: 1,
    unit: null,
    freq_times: 1,
    freq_days: 1,
    color: '#3B82F6',
    sort_order: 0,
    archived: false,
    created_at: '2025-06-01',
    ...overrides,
  }
}

function epoch(overrides: Partial<ScheduleEpoch> = {}): ScheduleEpoch {
  return {
    id: 'e1',
    effective_from: '2025-06-01',
    schedule_type: 'daily',
    scheduled_days: null,
    interval_days: null,
    weekly_target: null,
    ...overrides,
  }
}

const entry = (date: string, value = 1, status?: 'done' | 'skipped'): Entry =>
  status ? { date, value, status } : { date, value }

// Week of 2026-01-05 (Monday) .. 2026-01-11 (Sunday); logical today Jan 8.
const build = (overrides: Partial<Parameters<typeof buildHabitMatrix>[0]> = {}) =>
  buildHabitMatrix({
    habits: [habit({ id: 'a' })],
    entriesByHabit: {},
    today: '2026-01-08',
    selectedDate: '2026-01-08',
    viewMode: 'all',
    epochsByHabit: { a: [epoch()] },
    ...overrides,
  })

describe('habitMatrix — seven-day week boundaries', () => {
  it('returns Monday..Sunday dates for a mid-week selection', () => {
    const m = build({ selectedDate: '2026-01-08' }) // Thursday
    expect(m.dates).toHaveLength(7)
    expect(m.dates[0]).toBe('2026-01-05')
    expect(m.dates[6]).toBe('2026-01-11')
  })

  it('anchors to the same week when the selection is Monday or Sunday', () => {
    for (const selectedDate of ['2026-01-05', '2026-01-11']) {
      expect(build({ selectedDate }).dates[0]).toBe('2026-01-05')
      expect(build({ selectedDate }).dates[6]).toBe('2026-01-11')
    }
  })

  it('moves to the previous Monday when the selection is the prior week', () => {
    const m = build({ selectedDate: '2026-01-04' })
    expect(m.dates[0]).toBe('2025-12-29')
    expect(m.dates[6]).toBe('2026-01-04')
  })

  it('rows follow the given habit order', () => {
    const m = build({
      habits: [habit({ id: 'b', sort_order: 2 }), habit({ id: 'a', sort_order: 1 })],
      viewMode: 'all',
    })
    expect(m.rows.map((r) => r.habit.id)).toEqual(['b', 'a'])
  })
})

describe('habitMatrix — cell status mapping (via dayStatus)', () => {
  it('maps a check-in to done and an unchecked day to pending (never "missed")', () => {
    const m = build({ entriesByHabit: { a: [entry('2026-01-05')] } })
    expect(m.rows[0].cells[0]).toMatchObject({ date: '2026-01-05', state: 'done' })
    expect(m.rows[0].cells[1]).toMatchObject({ date: '2026-01-06', state: 'pending' })
    expect(MATRIX_STATE_LABEL.pending).not.toContain('missed')
  })

  it('maps skipped days (neutral) and vacation days; done wins on vacation', () => {
    const m = build({
      entriesByHabit: { a: [entry('2026-01-06', 0, 'skipped')] },
      vacations: ['2026-01-07'],
    })
    expect(m.rows[0].cells[1]).toMatchObject({ state: 'skipped' })
    expect(m.rows[0].cells[2]).toMatchObject({ state: 'vacation' })
    const withDone = build({
      entriesByHabit: { a: [entry('2026-01-07')] },
      vacations: ['2026-01-07'],
    })
    expect(withDone.rows[0].cells[2]).toMatchObject({ state: 'done' })
  })

  it('maps interval off-days to unscheduled', () => {
    const m = build({
      habits: [habit({ id: 'i', schedule_type: 'interval', interval_days: 3, created_at: '2026-01-05' })],
      epochsByHabit: {
        i: [epoch({ schedule_type: 'interval', interval_days: 3, effective_from: '2026-01-05' })],
      },
    })
    // Interval of 3 from Monday: Mon scheduled, Tue/Wed off, Thu scheduled...
    expect(m.rows[0].cells[0].state).toBe('pending') // scheduled but unchecked
    expect(m.rows[0].cells[1]).toMatchObject({ state: 'unscheduled' })
    expect(m.rows[0].cells[2]).toMatchObject({ state: 'unscheduled' })
    expect(m.rows[0].cells[3]).toMatchObject({ state: 'pending' })
  })

  it('maps days before created_at to before-start', () => {
    const m = build({
      habits: [habit({ id: 'late', created_at: '2026-01-07' })],
      epochsByHabit: { late: [epoch({ effective_from: '2026-01-07' })] },
    })
    expect(m.rows[0].cells[0]).toMatchObject({ state: 'before-start' })
    expect(m.rows[0].cells[2]).toMatchObject({ state: 'pending' })
  })

  it('future cells carry the future state and no values', () => {
    const m = build({ today: '2026-01-08' })
    expect(m.rows[0].cells[4]).toMatchObject({ date: '2026-01-09', state: 'future' })
    expect(m.rows[0].cells[6]).toMatchObject({ date: '2026-01-11', state: 'future' })
    expect(matrixCellLabel(m.rows[0].cells[4])).toContain('future')
    expect(matrixCellLabel(m.rows[0].cells[4])).not.toMatch(/done|pending/)
  })

  it('flags the selected date and the logical today independently', () => {
    const m = build({ selectedDate: '2026-01-06', today: '2026-01-08' })
    expect(m.rows[0].cells.map((c) => c.selected)).toEqual([false, true, false, false, false, false, false])
    expect(m.rows[0].cells.map((c) => c.isToday)).toEqual([false, false, false, true, false, false, false])
  })
})

describe('habitMatrix — weekly-target habits (daily check-ins, not daily obligations)', () => {
  const shower = habit({
    id: 'shower',
    name: 'SHOWER',
    schedule_type: 'weekly_target',
    weekly_target: 4,
    created_at: '2025-06-01',
  })
  const epochs = { shower: [epoch({ schedule_type: 'weekly_target', weekly_target: 4 })] }

  it('shows actual check-ins as done and unchecked weekdays as plain pending', () => {
    const m = build({
      habits: [shower],
      entriesByHabit: { shower: [entry('2026-01-05'), entry('2026-01-07')] },
      epochsByHabit: epochs,
    })
    expect(m.rows[0].cells[0]).toMatchObject({ state: 'done' })
    expect(m.rows[0].cells[1]).toMatchObject({ state: 'pending' })
    expect(m.rows[0].cells[2]).toMatchObject({ state: 'done' })
    expect(m.rows[0].cells[3]).toMatchObject({ state: 'pending' })
    for (const cell of m.rows[0].cells) {
      expect(cell.state).not.toBe('unscheduled')
    }
  })

  it('keeps later-week days pending after the weekly goal is achieved', () => {
    const m = build({
      habits: [shower],
      entriesByHabit: {
        shower: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'].map((d) => entry(d)),
      },
      epochsByHabit: epochs,
      today: '2026-01-09',
    })
    expect(m.rows[0].cells[4]).toMatchObject({ date: '2026-01-09', state: 'pending' })
  })

  it('counts an extra post-goal check-in as done', () => {
    const m = build({
      habits: [shower],
      entriesByHabit: {
        shower: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'].map((d) => entry(d)),
      },
      epochsByHabit: epochs,
      today: '2026-01-09',
    })
    expect(m.rows[0].cells[4]).toMatchObject({ state: 'done' })
  })
})

describe('habitMatrix — Scheduled vs All Habits row filtering', () => {
  it('All Habits shows every active habit; Scheduled drops a habit that is off all week', () => {
    const offHabit = habit({
      id: 'off',
      name: 'Weekend only',
      schedule_type: 'weekdays',
      scheduled_days: 65, // Sat+Sun bitmask
      created_at: '2025-06-01',
    })
    const habits = [habit({ id: 'daily' }), offHabit]
    const epochsByHabit = {
      daily: [epoch()],
      off: [epoch({ schedule_type: 'weekdays', scheduled_days: 65 })],
    }
    const all = build({ habits, epochsByHabit, viewMode: 'all' })
    expect(all.rows.map((r) => r.habit.id)).toEqual(['daily', 'off'])
    const scheduled = build({ habits, epochsByHabit, viewMode: 'scheduled' })
    expect(scheduled.rows.map((r) => r.habit.id)).toEqual(['daily'])
  })

  it('Scheduled keeps a weekly habit that is eligible on at least one day of the week', () => {
    const shower = habit({ id: 'shower', schedule_type: 'weekly_target', weekly_target: 4, created_at: '2025-06-01' })
    const m = build({
      habits: [shower],
      epochsByHabit: { shower: [epoch({ schedule_type: 'weekly_target', weekly_target: 4 })] },
      viewMode: 'scheduled',
    })
    expect(m.rows).toHaveLength(1)
  })

  it('Scheduled eligibility never leaks later check-ins backwards (as-of-day evaluation)', () => {
    const shower = habit({ id: 'shower', schedule_type: 'weekly_target', weekly_target: 4, created_at: '2025-06-01' })
    // Goal achieved Thursday; Monday was still a pending, visible day.
    const m = build({
      habits: [shower],
      entriesByHabit: {
        shower: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'].map((d) => entry(d)),
      },
      epochsByHabit: { shower: [epoch({ schedule_type: 'weekly_target', weekly_target: 4 })] },
      viewMode: 'scheduled',
    })
    expect(m.rows).toHaveLength(1)
  })

  it('Scheduled includes a habit that starts mid-week (with before-start cells)', () => {
    const late = habit({ id: 'late', created_at: '2026-01-07' })
    const m = build({
      habits: [late],
      epochsByHabit: { late: [epoch({ effective_from: '2026-01-07' })] },
      viewMode: 'scheduled',
    })
    expect(m.rows).toHaveLength(1)
    expect(m.rows[0].cells[0]).toMatchObject({ state: 'before-start' })
  })

  it('archived habits never appear', () => {
    const m = build({
      habits: [habit({ id: 'x', archived: true })],
      viewMode: 'all',
    })
    expect(m.rows).toHaveLength(0)
  })
})

describe('habitMatrix — cell actions (interactive refinement)', () => {
  const booleanHabit = habit({ id: 'b', type: 'boolean' })
  const numericHabit = habit({ id: 'n', type: 'numeric', target: 8, unit: 'glasses' })
  const buildCells = (h: Habit, entries: Entry[] = [], overrides = {}) =>
    build({
      habits: [h],
      entriesByHabit: { [h.id]: entries },
      epochsByHabit: { [h.id]: [epoch()] },
      ...overrides,
    }).rows[0].cells

  it('boolean cells toggle: done undoes, pending checks in', () => {
    const cells = buildCells(booleanHabit, [entry('2026-01-05')])
    expect(matrixCellAction(cells[0], booleanHabit)).toBe('toggle') // done → undo
    expect(matrixCellAction(cells[1], booleanHabit)).toBe('toggle') // pending → check in
  })

  it('numeric cells NEVER auto-complete: they open the value editor', () => {
    const cells = buildCells(numericHabit, [entry('2026-01-05', 5)])
    expect(matrixCellAction(cells[0], numericHabit)).toBe('edit-value') // done
    expect(matrixCellAction(cells[1], numericHabit)).toBe('edit-value') // pending
  })

  it('skipped cells undo the skip via the existing skip toggle', () => {
    const cells = buildCells(booleanHabit, [entry('2026-01-06', 0, 'skipped')])
    expect(matrixCellAction(cells[1], booleanHabit)).toBe('unskip')
  })

  it('vacation (no entry), unscheduled, before-start and future cells are not interactive', () => {
    const cells = buildCells(
      booleanHabit,
      [],
      { vacations: ['2026-01-07'], today: '2026-01-08' },
    )
    expect(matrixCellAction(cells[2], booleanHabit)).toBeNull() // vacation
    expect(matrixCellAction(cells[4], booleanHabit)).toBeNull() // future
    const lateHabit = habit({ id: 'late', created_at: '2026-01-07' })
    const late = buildCells(lateHabit, [], {
      epochsByHabit: { late: [epoch({ effective_from: '2026-01-07' })] },
    })
    expect(matrixCellAction(late[0], lateHabit)).toBeNull() // before-start
    const intervalHabit = habit({
      id: 'i',
      schedule_type: 'interval',
      interval_days: 3,
      created_at: '2026-01-05',
    })
    const interval = buildCells(intervalHabit, [], {
      epochsByHabit: { i: [epoch({ schedule_type: 'interval', interval_days: 3, effective_from: '2026-01-05' })] },
    })
    expect(matrixCellAction(interval[1], intervalHabit)).toBeNull() // unscheduled
  })

  it('numeric done rows carry their value for the editor prefill; pending/skipped/future do not', () => {
    const cells = buildCells(numericHabit, [
      entry('2026-01-05', 5),
      entry('2026-01-06', 0, 'skipped'),
    ])
    expect(cells[0].value).toBe(5)
    expect(cells[1].value).toBeUndefined() // skipped: 0 is storage-only
    expect(cells[2].value).toBeUndefined() // pending
    expect(cells[4].value).toBeUndefined() // future — no values ever
  })

  it('a done check-in made on a vacation day still toggles off (done wins)', () => {
    const cells = buildCells(booleanHabit, [entry('2026-01-07')], { vacations: ['2026-01-07'] })
    expect(cells[2].state).toBe('done')
    expect(matrixCellAction(cells[2], booleanHabit)).toBe('toggle')
  })
})

describe('habitMatrix — accessibility labels and caption', () => {
  it('labels describe the date and the state', () => {
    const m = build({ entriesByHabit: { a: [entry('2026-01-05')] } })
    expect(matrixCellLabel(m.rows[0].cells[0])).toBe('Mon, Jan 5 — done')
    expect(matrixCellLabel(m.rows[0].cells[1])).toBe('Tue, Jan 6 — pending')
    expect(matrixCellLabel(m.rows[0].cells[4])).toBe('Fri, Jan 9 — future')
  })

  it('vacation and skipped states have distinct accessible descriptions', () => {
    expect(MATRIX_STATE_LABEL.skipped).toContain('neutral')
    expect(MATRIX_STATE_LABEL.vacation).toContain('vacation')
    expect(MATRIX_STATE_LABEL['before-start']).toContain('before')
    expect(MATRIX_STATE_LABEL.unscheduled).toContain('not scheduled')
  })

  it('caption names the Monday–Sunday span', () => {
    expect(matrixCaption(build().dates)).toBe('Habit checklist · Mon, Jan 5 – Sun, Jan 11')
  })
})

describe('numericCellProgress — fill calculation and clamping', () => {
  it('partial values produce a proportional fill and a compact label', () => {
    const third = numericCellProgress(3, 9)
    expect(third.pct).toBeCloseTo(33.3333, 3)
    expect(third.label).toBe('3/9')
    expect(numericCellProgress(1, 4)).toEqual({ pct: 25, label: '1/4' })
  })

  it('clamps the fill to 0–100% while preserving actual numbers', () => {
    const over = numericCellProgress(12, 9)
    expect(over.pct).toBe(100)
    expect(over.label).toBe('12/9') // actual value kept in the label
    expect(numericCellProgress(-2, 9).pct).toBe(0) // negative clamps visually
    // Exact completion keeps the numeric label instead of only a checkmark.
    expect(numericCellProgress(9, 9)).toEqual({ pct: 100, label: '9/9' })
  })

  it('zero and missing/invalid values show no misleading progress', () => {
    expect(numericCellProgress(0, 9)).toEqual({ pct: 0, label: '0/9' }) // honest zero
    expect(numericCellProgress(undefined, 9)).toEqual({ pct: 0, label: null })
    expect(numericCellProgress(null, 9)).toEqual({ pct: 0, label: null })
    expect(numericCellProgress(Number.NaN, 9)).toEqual({ pct: 0, label: null })
    expect(numericCellProgress(Number.POSITIVE_INFINITY, 9)).toEqual({ pct: 0, label: null })
  })

  it('invalid targets disable progress entirely', () => {
    expect(numericCellProgress(3, 0)).toEqual({ pct: 0, label: null })
    expect(numericCellProgress(3, -5)).toEqual({ pct: 0, label: null })
    expect(numericCellProgress(3, Number.NaN)).toEqual({ pct: 0, label: null })
  })

  it('long values drop the chip label (tooltip/aria fallback carries the full value)', () => {
    expect(numericCellProgress(100, 100).label).toBeNull()
    expect(numericCellProgress(100, 100).pct).toBe(100)
    // 6+ characters ("2.5/10", "100/100") would clip in a 32px chip.
    expect(numericCellProgress(2.5, 10).label).toBeNull()
    expect(numericCellProgress(2.5, 10).pct).toBe(25)
  })
})

describe('numericCellDisplayValue — untouched numerics read 0/target (display-only)', () => {
  // The repro cases: Reflection/Gratitude (target 10) and Workout (target 30)
  // showed blank cells until a value was recorded, while a recorded zero
  // showed "0/10"/"0/30".
  function cellOf(m: ReturnType<typeof buildHabitMatrix>, date: string) {
    return m.rows[0].cells.find((c) => c.date === date)!
  }

  const withNumeric = (entries: Entry[]) =>
    build({
      habits: [habit({ id: 'a', type: 'numeric', target: 10, unit: 'min' })],
      entriesByHabit: { a: entries },
    })

  it('falls back to a display 0 for an eligible pending cell with no entry', () => {
    const m = withNumeric([])
    const cell = cellOf(m, '2026-01-08') // past weekday, no entry → pending
    expect(cell.state).toBe('pending')
    expect(cell.value).toBeUndefined() // nothing stored…
    expect(numericCellDisplayValue(cell)).toBe(0) // …but it displays as 0
    // Rendered exactly like a recorded zero, for both repro targets.
    expect(numericCellProgress(numericCellDisplayValue(cell)!, 10)).toEqual({ pct: 0, label: '0/10' })
    expect(numericCellProgress(numericCellDisplayValue(cell)!, 30)).toEqual({ pct: 0, label: '0/30' })
  })

  it('a recorded zero displays identically to the untouched fallback', () => {
    const cell = cellOf(withNumeric([entry('2026-01-08', 0)]), '2026-01-08') // explicit 0 entry
    expect(cell.state).toBe('pending') // 0 < target → not done
    expect(cell.value).toBe(0) // stored zero
    expect(numericCellDisplayValue(cell)).toBe(0)
    expect(numericCellProgress(cell.value, 10)).toEqual(numericCellProgress(numericCellDisplayValue(cell), 10))
  })

  it('partial and completed values keep the stored value (no fallback)', () => {
    const partialCell = cellOf(withNumeric([entry('2026-01-08', 4)]), '2026-01-08')
    expect(partialCell.value).toBe(4)
    expect(numericCellDisplayValue(partialCell)).toBe(4)
    const completedCell: MatrixCell = {
      date: '2026-01-08',
      weekday: 'Thu',
      dayNumber: 8,
      state: 'done',
      selected: false,
      isToday: false,
      value: 12,
    }
    expect(numericCellDisplayValue(completedCell)).toBe(12)
    expect(numericCellProgress(completedCell.value, 9)).toEqual({ pct: 100, label: '12/9' })
  })

  it('non-pending states keep their value-less appearance (no fallback)', () => {
    const base = { date: '2026-01-08', weekday: 'Thu', dayNumber: 8, selected: false, isToday: false }
    for (const state of ['skipped', 'vacation', 'unscheduled', 'future', 'before-start'] as const) {
      expect(numericCellDisplayValue({ ...base, state })).toBeUndefined()
    }
    // A skipped numeric row never shows 0/target — the skip glyph stays.
    const skipped = cellOf(withNumeric([entry('2026-01-08', 0, 'skipped')]), '2026-01-08')
    expect(skipped.state).toBe('skipped')
    expect(numericCellDisplayValue(skipped)).toBeUndefined()
  })

  it('the display fallback persists nothing — the built matrix stores no value', () => {
    for (const cell of withNumeric([]).rows[0].cells) {
      if (cell.state === 'pending') expect(cell.value).toBeUndefined()
    }
  })
})

describe('revealColumnScroll — selected-date reveal geometry', () => {
  const base = { clientWidth: 300, scrollWidth: 430, stickyWidth: 120 }

  it('already fully visible (clear of the sticky column) does not scroll', () => {
    expect(revealColumnScroll({ ...base, scrollLeft: 40, columnLeft: 200, columnWidth: 50 })).toBeNull()
    expect(revealColumnScroll({ ...base, scrollLeft: 0, columnLeft: 120, columnWidth: 50 })).toBeNull()
  })

  it('a column partially hidden behind the sticky habit-name column is NOT visible and scrolls minimally', () => {
    // Viewport [60,360], sticky covers [60,180]; column [170,220] pokes out
    // from behind the sticky edge by 10px of scroll (target 50 → viewport
    // [50,350], sticky [50,170], column fully clear). Minimum distance.
    expect(revealColumnScroll({ ...base, scrollLeft: 60, columnLeft: 170, columnWidth: 50 })).toBe(50)
  })

  it('scrolls the minimum distance to bring a right-cut column into view', () => {
    // Column [280,330] with viewport [0,300]: align the right edge → 30.
    expect(revealColumnScroll({ ...base, scrollLeft: 0, columnLeft: 280, columnWidth: 50 })).toBe(30)
  })

  it('a column left of the viewport scrolls just enough to clear the sticky column', () => {
    // Viewport [100,400]; column [150,200] sits behind sticky [100,220].
    // Band = [-100, 30] → target 30 (a 70px move, not a full reset to 0).
    expect(revealColumnScroll({ ...base, scrollLeft: 100, columnLeft: 150, columnWidth: 50 })).toBe(30)
  })

  it('week navigation to a far-right column aligns its right edge (clamped to range)', () => {
    // Sunday column [380,430]; viewport [0,300]; max scroll = 130.
    expect(revealColumnScroll({ ...base, scrollLeft: 0, columnLeft: 380, columnWidth: 50 })).toBe(130)
  })

  it('a column that can never clear the sticky column is a no-op (no fighting the scroll)', () => {
    // Column starts inside the sticky column's content footprint: no
    // scrollLeft can clear it, so nothing happens.
    expect(revealColumnScroll({ ...base, scrollLeft: 0, columnLeft: 100, columnWidth: 50 })).toBeNull()
  })
})

describe('Matrix theme parity — High Contrast shares layout with Dark', () => {
  it('matrixCellAction returns identical actions regardless of theme (theme affects color only)', () => {
    const booleanHabit = habit({ id: 'b', type: 'boolean' })
    const numericHabit = habit({ id: 'n', type: 'numeric', target: 8, unit: 'glasses' })

    // Theme does not change cell interaction logic — identical for all themes
    const doneCell: MatrixCell = { date: '2026-01-05', weekday: 'Mon', dayNumber: 5, state: 'done', selected: false, isToday: false }
    const pendingCell: MatrixCell = { date: '2026-01-06', weekday: 'Tue', dayNumber: 6, state: 'pending', selected: false, isToday: false }
    const skippedCell: MatrixCell = { date: '2026-01-07', weekday: 'Wed', dayNumber: 7, state: 'skipped', selected: false, isToday: false }
    const vacationCell: MatrixCell = { date: '2026-01-08', weekday: 'Thu', dayNumber: 8, state: 'vacation', selected: false, isToday: false }
    const unscheduledCell: MatrixCell = { date: '2026-01-09', weekday: 'Fri', dayNumber: 9, state: 'unscheduled', selected: false, isToday: false }
    const futureCell: MatrixCell = { date: '2026-01-10', weekday: 'Sat', dayNumber: 10, state: 'future', selected: false, isToday: false }

    expect(matrixCellAction(doneCell, booleanHabit)).toBe('toggle')
    expect(matrixCellAction(doneCell, numericHabit)).toBe('edit-value')
    expect(matrixCellAction(pendingCell, booleanHabit)).toBe('toggle')
    expect(matrixCellAction(pendingCell, numericHabit)).toBe('edit-value')
    expect(matrixCellAction(skippedCell, booleanHabit)).toBe('unskip')
    expect(matrixCellAction(vacationCell, booleanHabit)).toBeNull()
    expect(matrixCellAction(unscheduledCell, booleanHabit)).toBeNull()
    expect(matrixCellAction(futureCell, booleanHabit)).toBeNull()
  })

  it('buildHabitMatrix produces identical data regardless of theme', () => {
    const m1 = build({})
    const m2 = build({})

    expect(m1.dates).toEqual(m2.dates)
    expect(m1.rows.length).toBe(m2.rows.length)
    for (let i = 0; i < m1.rows.length; i++) {
      expect(m1.rows[i].cells.map((c) => c.state)).toEqual(m2.rows[i].cells.map((c) => c.state))
      expect(m1.rows[i].cells.map((c) => c.selected)).toEqual(m2.rows[i].cells.map((c) => c.selected))
    }
  })
})

describe('Matrix diagnostic code removal', () => {
  it('HabitMatrix module does not export diagnostic functions', async () => {
    const module = await import('../components/HabitMatrix')

    // Diagnostic functions must NOT be present
    // @ts-expect-error — diagnostic functions should not exist on the module
    expect(module.captureDiag).toBeUndefined()
    // @ts-expect-error — diagnostic functions should not exist on the module
    expect(module.MatrixDebugPanel).toBeUndefined()
    // @ts-expect-error — diagnostic functions should not exist on the module
    expect(module.getOverflowingElements).toBeUndefined()
    // @ts-expect-error — diagnostic functions should not exist on the module
    expect(module.getScrollableAncestors).toBeUndefined()

    // Core exports must still be present
    expect(module.HabitMatrix).toBeDefined()
  })
})

describe('matrixNameKeyAction — habit-name cell keyboard activation', () => {
  it('Enter activates natively (the name cell is an anchor)', () => {
    expect(matrixNameKeyAction('Enter')).toBe('native')
  })

  it('Space is handled explicitly (anchors do not activate on Space)', () => {
    expect(matrixNameKeyAction(' ')).toBe('space')
  })

  it('every other key is a no-op (no navigation side effects)', () => {
    for (const key of ['a', 'Tab', 'Escape', 'ArrowRight', 'Space', '']) {
      expect(matrixNameKeyAction(key)).toBeNull()
    }
  })
})
