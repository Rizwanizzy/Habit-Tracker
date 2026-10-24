import type { CSSProperties } from 'react'
import type { Entry, Habit } from '../lib/score'
import { addDays, parseLocalDate, todayString } from '../lib/dates'

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
}

/** Levels per DESIGN.md §7 heatmap intensities (12/35/65/100%):
 *  1 = trace (12%), 2 = partial (35%), 3 = almost (65%), 4 = done (100%). */
function levelFor(habit: Habit, entry: Entry | undefined): number {
  if (!entry || entry.value <= 0) return 0
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

function statusText(level: number, future: boolean): string {
  if (future) return 'Not started yet'
  if (level === 0) return 'Not completed'
  if (level === 1) return 'Trace progress'
  if (level === 2) return 'Partial progress'
  if (level === 3) return 'Almost at target'
  return 'Completed'
}

type Cell = { date: string; level: number; future: boolean }

/** Loop-style calendar heatmap (DESIGN.md §7): weeks as columns, Sun–Sat as
 *  rows, 14px cells with 4px radius and gap, month labels on top, weekday
 *  labels left. Tapping a day toggles it. */
export function Heatmap({ habit, entries, weeks = 18, onToggle }: Props) {
  const today = todayString()
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
      col.push({
        date,
        level: future ? -1 : levelFor(habit, byDate.get(date)),
        future,
      })
    }
    const month = parseLocalDate(col[0].date).getMonth()
    if (month !== prevMonth) monthLabels.push({ col: w, text: MONTH_FMT.format(parseLocalDate(col[0].date)) })
    prevMonth = month
    columns.push(col)
  }

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
          {monthLabels.map(({ col, text }) => (
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
                return (
                  <button
                    key={`${w}-${r}`}
                    type="button"
                    title={`${cell.date} — ${statusText(cell.level, cell.future)}`}
                    onClick={() => onToggle?.(cell.date)}
                    className="cursor-pointer rounded-[4px] transition-transform duration-150 active:scale-90"
                    style={levelStyle(habit, cell.level)}
                    aria-label={`${cell.date}: ${statusText(cell.level, cell.future)}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
