import { intensityPct, yearMonthLabels, type DayCompletion } from '../lib/completion'
import { parseLocalDate } from '../lib/dates'

const CELL = 10
const GAP = 3
const ROW_LABEL_W = 28
const ROWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TITLE_FMT = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })

interface Props {
  /** Trailing-10-month heatmap columns (Sun–Sat rows, week columns ending
   *  in the current week). */
  columns: string[][]
  completions: Map<string, DayCompletion>
  color: string
  today: string
}

/** Year view (DESIGN.md §8): GitHub-style heatmap over the trailing 10
 *  months ending at the current month — no horizontal scrollbar. Columns
 *  flex (`1fr`) so the grid always fits the card width; each small square
 *  is filled with the chosen color at the day's completion intensity. */
export function CompletionYear({ columns, completions, color, today }: Props) {
  const labels = yearMonthLabels(columns)
  const gridTemplate = `${ROW_LABEL_W}px repeat(${columns.length}, minmax(0, 1fr))`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
        {/* Month labels */}
        <div
          className="grid"
          style={{ gridTemplateColumns: gridTemplate, columnGap: GAP, height: CELL + 2 }}
        >
          <span />
          {labels.map(({ col, text }) => (
            <span
              key={col}
              className="text-[10px] uppercase tracking-wide text-fg-muted"
              style={{ gridColumn: `${col + 2} / span 1`, alignSelf: 'end' }}
            >
              {text}
            </span>
          ))}
        </div>

        {/* Day grid: one row per weekday */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: gridTemplate,
            columnGap: GAP,
            rowGap: GAP,
            gridAutoRows: CELL,
          }}
        >
          {ROWS.map((wd, r) => (
            <div key={wd} style={{ display: 'contents' }}>
              <span
                className="text-[10px] uppercase tracking-wide text-fg-muted"
                style={{
                  alignSelf: 'center',
                  justifySelf: 'end',
                  width: ROW_LABEL_W - GAP,
                  // GitHub-style: only Mon / Wed / Fri keep a label.
                  visibility: r % 2 === 1 ? 'visible' : 'hidden',
                }}
              >
                {wd.slice(0, 2)}
              </span>
              {columns.map((col, w) => {
                const date = col[r]
                const key = `${w}-${r}`
                if (date > today) {
                  return (
                    <span
                      key={key}
                      className="rounded-[2.5px]"
                      style={{ backgroundColor: 'transparent' }}
                    />
                  )
                }
                const c = completions.get(date)
                const pct = c ? intensityPct(c.frac) : 0
                const label = c
                  ? `${TITLE_FMT.format(parseLocalDate(date))} — ${c.done} of ${c.eligible} done`
                  : `${TITLE_FMT.format(parseLocalDate(date))} — no habits yet`
                return (
                  <span
                    key={key}
                    title={label}
                    aria-label={label}
                    className="rounded-[2.5px]"
                    style={{
                      backgroundColor: pct
                        ? `color-mix(in srgb, ${color} ${pct}%, transparent)`
                        : 'var(--surface-2)',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
    </div>
  )
}
