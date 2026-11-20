import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { HabitMatrix, ValueEditor } from './HabitMatrix'
import { buildHabitMatrix, matrixCellAction, matrixCellLabel } from '../lib/habitMatrix'
import type { Habit } from '../lib/score'

/** Matrix navigation parity with Today → Tiles: the habit-name cell (icon +
 *  name) is a link to the SAME Habit Detail route the tiles use, while date
 *  cells keep their check-in / value-editor behavior and never navigate.
 *  Rendered statically (no DOM needed) so the markup itself is asserted. */

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

const run = habit({ id: 'run', name: 'Run', color: '#22C55E', emoji: '🏃' })
const water = habit({
  id: 'water',
  name: 'Water',
  type: 'numeric',
  target: 8,
  unit: 'glasses',
  sort_order: 1,
})

const data = buildHabitMatrix({
  habits: [run, water],
  entriesByHabit: { run: [{ date: '2026-01-05', value: 1 }] },
  today: '2026-01-08',
  selectedDate: '2026-01-08',
  viewMode: 'all',
})

const noop = () => {}

function render() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <HabitMatrix data={data} onToggle={noop} onLogValue={noop} onSkip={noop} nameWidth={1} />
    </MemoryRouter>,
  )
}

const html = render()
const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])

describe('HabitMatrix — habit-name cell opens Habit Detail', () => {
  it('links each habit row to that habit’s own Habit Detail route (tiles’ route)', () => {
    expect(hrefs).toEqual(['/habits/run', '/habits/water'])
  })

  it('gives the name cell a meaningful accessible name (icon and name are one target)', () => {
    expect(html).toContain('aria-label="View Run overview"')
    expect(html).toContain('aria-label="View Water overview"')
    // The overlay itself adds no box: absolute inset-0 covers the whole cell.
    expect(html).toContain('absolute inset-0 rounded-[6px]')
  })

  it('keeps the name cell’s title (truncation tooltip) without changing the visible name', () => {
    expect(html).toContain('title="Run"')
    expect(html).toContain('>Run</span>')
    expect(html).toContain('>Water</span>')
  })
})

describe('HabitMatrix — row reorder handle + first-column layout (Task 2)', () => {
  it('renders a compact six-dot handle before the emoji and the name', () => {
    const handle = html.indexOf('aria-label="Reorder Run"')
    const emoji = html.indexOf('🏃')
    const name = html.indexOf('>Run</span>')
    expect(handle).toBeGreaterThan(-1)
    expect(handle).toBeLessThan(emoji)
    expect(emoji).toBeLessThan(name)
    expect(html).toContain('title="Drag to reorder"')
  })

  it('makes the handle a keyboard-focusable control (accessible reordering)', () => {
    expect(html).toMatch(/<button[^>]*tabindex="0"[^>]*aria-label="Reorder Run"/)
    expect(html).toContain('aria-roledescription="sortable"')
  })

  it('keeps the three first-column elements optically consistent and centred', () => {
    expect(html).toContain('size-[18px]') // six-dot glyph
    expect(html).toContain('size-[22px]') // emoji box (+10% from 20px)
    expect(html).toContain('text-[14px]') // name (+~10% from 13px)
    expect(html).toContain('items-center') // one vertical line
  })

  it('keeps the full-cell Habit Detail link for the name tap', () => {
    expect(hrefs).toEqual(['/habits/run', '/habits/water'])
    expect(html).toContain('aria-label="View Run overview"')
  })
})

describe('HabitMatrix — date cells never navigate', () => {
  it('renders exactly one link per habit, so no date cell is a link', () => {
    // 7 date columns × 2 rows would be 14 extra anchors.
    expect(hrefs).toHaveLength(data.rows.length)
    expect(hrefs.every((h) => h.startsWith('/habits/'))).toBe(true)
  })

  it('keeps date cells on the existing check-in and value-editor behavior', () => {
    // Boolean done cell still toggles; numeric cell still opens the editor.
    expect(html).toContain(`aria-label="${`Run — ${matrixCellLabel(data.rows[0].cells[0])} — tap to undo`}"`)
    expect(html).toContain('aria-label="Water — Mon, Jan 5 — pending (0 / 8 glasses) — tap to edit value"')
    expect(html).toContain('aria-pressed="true"')
    // Non-interactive states stay non-buttons (no extra links either).
    expect(html).toContain(`aria-label="${`Run — ${matrixCellLabel(data.rows[0].cells[4])}`}"`)
  })
})

describe('HabitMatrix — scoped iOS long-press selection/callout suppression', () => {
  const chipButtons = [...html.matchAll(/<button[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes('mx-auto grid size-8'))
  const actionable = data.rows.reduce(
    (n, { habit, cells }) => n + cells.filter((cell) => matrixCellAction(cell, habit) != null).length,
    0,
  )

  it('gives every interactive date chip — and only those — the suppression class', () => {
    expect(chipButtons).toHaveLength(actionable)
    expect(actionable).toBeGreaterThan(0)
    for (const tag of chipButtons) expect(tag).toContain('matrix-cell-action')
  })

  it('leaves read-only date chips alone so suppression never creeps to non-actions', () => {
    const readOnlyChips = [...html.matchAll(/<span[^>]*class="[^"]*mx-auto grid size-8[^"]*"[^>]*>/g)].map(
      (m) => m[0],
    )
    expect(readOnlyChips.length).toBeGreaterThan(0)
    for (const tag of readOnlyChips) expect(tag).not.toContain('matrix-cell-action')
  })

  it('keeps the numeric value editor input selectable/editable (class never reaches it)', () => {
    const editor = renderToStaticMarkup(
      <ValueEditor
        habit={water}
        cell={data.rows[1].cells[0]}
        onCommit={noop}
        onCancel={noop}
      />,
    )
    expect(editor).toContain('type="number"')
    // The 16px iOS no-zoom contract stays untouched.
    expect(editor).toContain('input-no-zoom')
    // The chip-only suppression must not disable caret/selection in the field.
    expect(editor).not.toContain('matrix-cell-action')
    expect(editor).not.toContain('user-select')
  })
})

describe('HabitMatrix — row alignment plumbing', () => {
  it('both panes render as .matrix-table, which carries the shared row height', () => {
    const tables = [...html.matchAll(/<table class="([^"]*)"/g)].map((m) => m[1])
    expect(tables).toHaveLength(2) // fixed names pane + scrolling dates pane
    for (const cls of tables) expect(cls).toContain('matrix-table')
  })

  it('name rows are the same table rows that get the shared height (no per-row sizing)', () => {
    // Every habit renders exactly one <tr> in each pane, none with inline height.
    const bodyRows = [...html.matchAll(/<tr([^>]*)>/g)].filter((m) => !m[1].includes('</'))
    expect(bodyRows.length).toBeGreaterThanOrEqual(data.rows.length * 2)
    expect(html).not.toMatch(/<tr[^>]*style="[^"]*height/)
  })
})
