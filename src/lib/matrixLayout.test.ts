import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'

/** Matrix row alignment (2026-11-18): the fixed habit-name pane and the
 *  horizontally scrolling date pane are TWO SEPARATE tables, so they only
 *  align because one shared rule sets the same row height on both. The
 *  defect being guarded against: real `border-bottom` dividers add 1px to the
 *  cell's intrinsic height, and the date cells (32px chip + 8px padding +
 *  1px border = 41px) already exceeded the locked 40px row height while the
 *  name cells (floored by that height) did not — 1px of drift per habit row,
 *  reviewed as "lower rows are more misaligned". Dividers are therefore inset
 *  shadows (no layout height), and both panes read `--matrix-row-h`. */
const oneLine = css.replace(/\s+/g, ' ')

/** Every CSS rule whose selector mentions the matrix panes. */
const matrixRules = [...css.matchAll(/\.matrix-(?:table|names)[^{}]*\{[^}]*\}/g)].map((m) =>
  m[0].replace(/\s+/g, ' '),
)
const matrixCss = matrixRules.join(' ')

describe('matrix CSS — scoped iOS selection/callout suppression', () => {
  /** The single rule that owns the long-press chrome fix. */
  const touchRules = [...css.matchAll(/\.matrix-cell-action[^{}]*\{[^}]*\}/g)].map((m) =>
    m[0].replace(/\s+/g, ' '),
  )

  it('suppresses native text selection and the touch callout on actionable chips', () => {
    expect(touchRules).toHaveLength(1)
    const rule = touchRules[0]
    expect(rule).toContain('user-select: none')
    expect(rule).toContain('-webkit-user-select: none')
    expect(rule).toContain('-webkit-touch-callout: none')
  })

  it('keeps panning available so Matrix and page scrolling still work', () => {
    expect(touchRules[0]).toContain('touch-action: manipulation')
    expect(touchRules[0]).not.toContain('touch-action: none')
  })

  it('never applies the suppression globally or to editable inputs', () => {
    // The rule targets only the chip class — not inputs/textareas.
    expect(touchRules[0]).not.toMatch(/input|textarea/)
    // No html/body/* rule turns off selection for the whole app.
    expect(css).not.toMatch(
      /(?:^|\n)\s*(?:html|body|\*)(?:\s*,\s*(?:html|body|\*))*\s*\{[^}]*user-select\s*:\s*none/,
    )
  })
})

describe('matrix CSS — shared row sizing across both panes', () => {
  it('defines one row-height variable used by the header and every habit row', () => {
    expect(matrixCss).toContain('--matrix-row-h: 2.5rem')
    // Rows (both panes) and their cells all read the same variable.
    expect(oneLine).toContain('.matrix-table thead tr, .matrix-table tbody tr { height: var(--matrix-row-h); }')
    expect(matrixCss).toContain('height: var(--matrix-row-h)')
  })

  it('gives cells an explicit border-box height so content cannot grow a row', () => {
    expect(matrixCss).toContain('box-sizing: border-box')
    const cellRule = matrixRules.find((r) => r.includes('.matrix-table tbody td'))
    expect(cellRule).toBeDefined()
    expect(cellRule).toContain('height: var(--matrix-row-h)')
  })

  it('draws row dividers as inset shadows — a border would add 1px per row', () => {
    expect(matrixCss).toContain('box-shadow: inset 0 -1px 0 var(--border)')
    expect(matrixCss).not.toContain('border-bottom')
  })

  it('removes the divider from the last row without touching row height', () => {
    const lastRow = matrixRules.find((r) => r.includes(':last-child'))
    expect(lastRow).toBeDefined()
    expect(lastRow).toContain('box-shadow: none')
  })
})
