import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { Entry, Habit } from '../lib/score'
import { isDone } from '../lib/score'
import { dayStatus, isNeutral } from '../lib/dayStatus'
import { addDays, parseLocalDate } from '../lib/dates'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { sparseMonthLabels } from '../lib/completion'
import type { ScheduleEpoch } from '../lib/schedule'

const CELL = 14
const GAP = 4
const ROW_LABEL_W = 34
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_FMT = new Intl.DateTimeFormat('en', { month: 'short' })

interface Props {
  habit: Habit
  entries: Entry[]
  weeks?: number
  /** When true, calculates weeks from container width (Habit Detail responsive mode). */
  responsive?: boolean
  /** Minimum weeks in responsive mode. Default 6. */
  minWeeks?: number
  /** Maximum weeks in responsive mode. Default 52 (≈12 months). */
  maxWeeks?: number
  onToggle?: (date: string) => void
  /** Concrete vacation dates in the grid window: a vacation day gets the
   *  same neutral outlined look as a skipped day (unless it's done). */
  vacations?: readonly string[]
  /** Schedule history epochs for this habit; off-days become neutral. */
  epochs?: readonly ScheduleEpoch[]
  /** Callback fired when responsive week count changes. */
  onWeeksChange?: (weeks: number) => void
  /** Use compact two-row legend layout on mobile (Habit Detail Calendar). */
  compactLegend?: boolean
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

function statusText(level: number, future: boolean, kind?: 'skipped' | 'vacation' | 'unscheduled'): string {
  if (future) return 'Not started yet'
  if (kind === 'skipped') return 'Skipped'
  if (kind === 'vacation') return 'Vacation'
  if (kind === 'unscheduled') return 'Off day'
  if (level === 0) return 'Not completed'
  if (level === 1) return 'Trace progress'
  if (level === 2) return 'Partial progress'
  if (level === 3) return 'Almost at target'
  return 'Completed'
}

type Cell = { date: string; level: number; future: boolean; skipped: boolean; vacation: boolean; unscheduled: boolean }

/** Small legend under the grid (DESIGN.md §7): Done / Partial (numeric
 *  habits only) / Not completed / Off day / Vacation / Skipped (combined). */
function HeatmapLegend({ habit, compact = false }: { habit: Habit; compact?: boolean }) {
  const color = habit.color ?? '#3B82F6'
  const sample = 'size-3.5 shrink-0 rounded-[4px]'

  const doneItem = (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={sample} style={{ backgroundColor: color }} />
      Done
    </span>
  )

  const partialItem = habit.type === 'numeric' ? (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={sample} style={{ backgroundColor: `color-mix(in srgb, ${color} 35%, transparent)` }} />
      Partial
    </span>
  ) : null

  // Off Day, Vacation and Skipped share the same cell appearance (outlined transparent with border)
  const neutralItem = (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={sample}
        style={{ backgroundColor: 'transparent', border: '1.5px solid color-mix(in srgb, var(--fg) 40%, transparent)' }}
      />
      Off day / Vacation / Skipped
    </span>
  )

  const notCompletedItem = (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={sample} style={{ backgroundColor: 'var(--surface-2)' }} />
      Not completed
    </span>
  )

  if (compact) {
    // Mobile: two explicit rows, no wrapping within items
    // Row 1: Done | Partial (numeric) | Not completed
    // Row 2: Off day / Vacation / Skipped (combined)
    const row1Items = [doneItem, partialItem, notCompletedItem].filter(Boolean)
    
    return (
      <div aria-hidden="true" className="text-caption mt-3 text-fg-muted flex flex-col gap-1.5">
        <div className="flex items-center gap-x-2.5 flex-nowrap overflow-hidden">
          {row1Items.map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
        <div className="flex items-center gap-x-2.5 flex-nowrap overflow-hidden">
          <span>{neutralItem}</span>
        </div>
      </div>
    )
  }

  // Desktop: simplified single-row flex-wrap
  return (
    <div aria-hidden="true" className="text-caption mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-fg-muted">
      {doneItem}
      {partialItem}
      {notCompletedItem}
      {neutralItem}
    </div>
  )
}



/** Loop-style calendar heatmap (DESIGN.md §7): weeks as columns, Sun–Sat as
 *  rows, 14px cells with 4px radius and gap, month labels on top, weekday
 *  labels left. Tapping a day toggles it. */
export function Heatmap({
  habit,
  entries,
  weeks = 18,
  responsive = false,
  minWeeks = 6,
  maxWeeks = 52,
  onToggle,
  vacations = [],
  epochs,
  onWeeksChange,
  compactLegend = false,
}: Props) {
  const today = useLogicalToday()
  const byDate = new Map(entries.map((e) => [e.date, e]))

  // Responsive week calculation
  const [responsiveWeeks, setResponsiveWeeks] = useState(minWeeks)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!responsive || !containerRef.current) return

    const calculateWeeks = () => {
      const container = containerRef.current
      if (!container) return
      const width = container.clientWidth
      if (width <= 0) return

      // Total grid width = ROW_LABEL_W + weeks * CELL + (weeks - 1) * GAP
      // = ROW_LABEL_W + weeks * (CELL + GAP) - GAP
      // weeks = (width - ROW_LABEL_W + GAP) / (CELL + GAP)
      const availableForWeeks = width - ROW_LABEL_W + GAP
      const weekWidth = CELL + GAP
      const calculated = Math.floor(availableForWeeks / weekWidth)
      const clamped = Math.max(minWeeks, Math.min(maxWeeks, calculated))
      setResponsiveWeeks(clamped)
      onWeeksChange?.(clamped)
    }

    // Initial calculation
    calculateWeeks()

    // Observe container resize
    const resizeObserver = new ResizeObserver(() => {
      calculateWeeks()
    })
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [responsive, minWeeks, maxWeeks, onWeeksChange])

  const effectiveWeeks = responsive ? responsiveWeeks : weeks
  const dow = parseLocalDate(today).getDay()
  const lastSunday = addDays(today, -dow)
  const gridStart = addDays(lastSunday, -(effectiveWeeks - 1) * 7)

  const monthLabels: { col: number; text: string }[] = []
  let prevMonth = -1
  const columns: Cell[][] = []

  for (let w = 0; w < effectiveWeeks; w++) {
    const col: Cell[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(gridStart, w * 7 + i)
      const future = date > today
      const entry = byDate.get(date)
      // Use dayStatus with schedule to correctly mark off-days as unscheduled.
      const status = future
        ? 'future'
        : dayStatus({ habit, date, entry, today, vacations, schedule: epochs })
      const skipped = !future && entry?.status === 'skipped'
      const vacation = !future && vacations.includes(date) && !isDone(habit, entry)
      const unscheduled = !future && isNeutral(status) && !skipped && !vacation
      col.push({
        date,
        level: future ? -1 : levelFor(habit, entry),
        future,
        skipped,
        vacation,
        unscheduled,
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

  const gridTemplate = `${ROW_LABEL_W}px repeat(${effectiveWeeks}, ${CELL}px)`

  return (
    <div className={responsive ? "pb-1" : "overflow-x-auto pb-1"} ref={containerRef}>
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
              const kind = cell.unscheduled ? 'unscheduled' : cell.skipped ? 'skipped' : cell.vacation ? 'vacation' : undefined
              const title = `${cell.date} — ${statusText(cell.level, cell.future, kind)}`
              return (
                <button
                  key={`${w}-${r}`}
                  type="button"
                  title={title}
                  onClick={() => onToggle?.(cell.date)}
                  className="cursor-pointer rounded-[4px] transition-transform duration-150 active:scale-90"
                  style={
                    cell.unscheduled || cell.skipped || cell.vacation
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
      <HeatmapLegend habit={habit} compact={compactLegend} />
    </div>
  )
}
