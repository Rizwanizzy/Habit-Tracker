import type { CSSProperties } from 'react'
import type { Entry, Habit } from '../lib/score'
import { isDone } from '../lib/score'
import { addDays, parseLocalDate } from '../lib/dates'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { sparseMonthLabels } from '../lib/completion'

const CELL = 14
const GAP = 4
const ROW_LABEL_W = 34
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_FMT = new Intl.DateTimeFormat('en', { month: 'short' })

interface Props {
  habit: Habit
  entries: Entry[]
  weeks?: number
  onToggle?: (date: string) => void
  /** Concrete vacation dates in the grid window: a vacation day gets the
   *  same neutral outlined look as a skipped day (unless it's done). */
  vacations?: readonly string[]
}

/** Levels per DESIGN.md §7 heatmap intensities (12/35/65/100%):
 *  1 = trace (12%), 2 = partial (35%), 3 = almost (65%), 4 = done (100%). */
function levelFor(habit: Habit, entry: Entry | undefined): number {
  // A skipped row (status 'skipped', value 0 by NOT NULL) is never progress.
  if (!entry || entry.status === 'skipped' || entry.value <= 0) return 0
  if (habit.type === 'boolean') return 4
  const ratio = entry.value / Math.max(1, habit.target)
  if (ratio >= 1) return 4
  if (ratio >= 0.66) return 3
  if (ratio >= 0.33) return 2
  return 1
}

function levelStyle(habit: Habit, level: number): CSSProperties {
  const color = habit.color ?? '#3B82F6'
  if (level === 4)
    return {
      backgroundColor: color,
      boxShadow: `0 0 6px color-mix(in srgb, ${color} 55%, transparent)`,
    }
  if (level === 3) return { backgroundColor: `color-mix(in srgb, ${color} 65%, transparent)` }
  if (level === 2) return { backgroundColor: `color-mix(in srgb, ${color} 35%, transparent)` }
  if (level === 1) return { backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }
  return { backgroundColor: 'var(--surface-2)' }
}

function statusText(level: number, future: boolean, kind?: 'skipped' | 'vacation'): string {
  if (future) return 'Not started yet'
  if (kind === 'skipped') return 'Skipped'
  if (kind === 'vacation') return 'Vacation'
  if (level === 0) return 'Not completed'
  if (level === 1) return 'Trace progress'
  if (level === 2) return 'Partial progress'
  if (level === 3) return 'Almost at target'
  return 'Completed'
}

type Cell = { date: string; level: number; future: boolean; skipped: boolean; vacation: boolean }

/** Small legend under the grid (DESIGN.md §7): Done / Partial (numeric
 *  habits only) / Skipped / Not completed. */
function HeatmapLegend({ habit }: { habit: Habit }) {
  const color = habit.color ?? '#3B82F6'
  const sample = 'size-3.5 shrink-0 rounded-[4px]'
  return (
    <div aria-hidden="true" className="text-caption mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-fg-muted">
      <span className="flex items-center gap-1.5">
        <span className={sample} style={{ backgroundColor: color }} />
        Done
      </span>
      {habit.type === 'numeric' && (
        <span className="flex items-center gap-1.5">
          <span className={sample} style={{ backgroundColor: `color-mix(in srgb, ${color} 35%, transparent)` }} />
          Partial
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span
          className={sample}
          style={{ backgroundColor: 'transparent', border: '1.5px solid color-mix(in srgb, var(--fg) 40%, transparent)' }}
        />
        Skipped
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={sample}
          style={{ backgroundColor: 'transparent', border: '1.5px solid color-mix(in srgb, var(--fg) 40%, transparent)' }}
        />
        Vacation
      </span>
      <span className="flex items-center gap-1.5">
        <span className={sample} style={{ backgroundColor: 'var(--surface-2)' }} />
        Not completed
      </span>
    </div>
  )
}

/** Loop-style calendar heatmap (DESIGN.md §7): weeks as columns, Sun–Sat as
 *  rows, 14px cells with 4px radius and gap, month labels on top, weekday
 *  labels left. Tapping a day toggles it. */
export function Heatmap({ habit, entries, weeks = 18, onToggle, vacations = [] }: Props) {
  const today = useLogicalToday()
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const dow = parseLocalDate(today).getDay()
  const lastSunday = addDays(today, -dow)
  const gridStart = addDays(lastSunday, -(weeks - 1) * 7)

  const monthLabels: { col: number; text: string }[] = []
  let prevMonth = -1
  const columns: Cell[][] = []

  for (let w = 0; w < weeks; w++) {
    const col: Cell[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(gridStart, w * 7 + i)
      const future = date > today
      const entry = byDate.get(date)
      col.push({
        date,
        level: future ? -1 : levelFor(habit, entry),
        future,
        // A skipped row (value 0) is a neutral day, not a 0% miss...
        skipped: !future && entry?.status === 'skipped',
        // ...and so is a vacation day, unless a check-in marks it done.
        vacation: !future && vacations.includes(date) && !isDone(habit, entry),
      })
    }
    const month = parseLocalDate(col[0].date).getMonth()
    if (month !== prevMonth) monthLabels.push({ col: w, text: MONTH_FMT.format(parseLocalDate(col[0].date)) })
    prevMonth = month
    columns.push(col)
  }
  // Thin the labels: months that start only a column or two after the
  // previous one (Jun→Jul shift, December sliver) would collide.
  const visibleMonthLabels = sparseMonthLabels(monthLabels)

  const gridTemplate = `${ROW_LABEL_W}px repeat(${weeks}, ${CELL}px)`

  return (
    <div className="overflow-x-auto pb-1">
      <div style={{ width: 'fit-content' }}>
        {/* Month labels */}
        <div
          className="grid"
          style={{ gridTemplateColumns: gridTemplate, columnGap: GAP, height: CELL + 2 }}
        >
          <span />
          {visibleMonthLabels.map(({ col, text }) => (
            <span
              key={col}
              className="text-[11px] uppercase tracking-wide text-fg-muted"
              style={{ gridColumn: `${col + 2} / span 1`, alignSelf: 'end' }}
            >
              {text}
            </span>
          ))}
        </div>

        {/* Day grid: row-major, one row per weekday */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: gridTemplate,
            columnGap: GAP,
            rowGap: GAP,
            gridAutoRows: CELL,
          }}
        >
          {WEEKDAYS.map((wd, r) => (
            <div key={wd} style={{ display: 'contents' }}>
              <span
                className="text-[11px] uppercase tracking-wide text-fg-muted"
                style={{ alignSelf: 'center', justifySelf: 'end', width: ROW_LABEL_W - GAP }}
              >
                {wd.slice(0, 2)}
              </span>
              {columns.map((col, w) => {
                const cell = col[r]
                if (cell.future) {
                  return (
                    <div
                      key={`${w}-${r}`}
                      title={`${cell.date} — ${statusText(cell.level, cell.future)}`}
                      className="rounded-[4px]"
                      style={{ backgroundColor: 'transparent' }}
                    />
                  )
                }
                const kind = cell.skipped ? 'skipped' : cell.vacation ? 'vacation' : undefined
                const title = `${cell.date} — ${statusText(cell.level, cell.future, kind)}`
                return (
                  <button
                    key={`${w}-${r}`}
                    type="button"
                    title={title}
                    onClick={() => onToggle?.(cell.date)}
                    className="cursor-pointer rounded-[4px] transition-transform duration-150 active:scale-90"
                    style={
                      cell.skipped || cell.vacation
                        ? {
                            // Neutral outlined look — never a 0% miss.
                            backgroundColor: 'transparent',
                            border: '1.5px solid color-mix(in srgb, var(--fg) 40%, transparent)',
                          }
                        : levelStyle(habit, cell.level)
                    }
                    aria-label={title}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend (DESIGN.md §7): the heatmap gained a "Skipped" entry with
            the skip feature; Partial applies to numeric habits only. */}
        <HeatmapLegend habit={habit} />
      </div>
    </div>
  )
}
