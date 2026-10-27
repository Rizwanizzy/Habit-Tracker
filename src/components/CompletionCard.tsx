import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorPicker } from './ColorPicker'
import { CompletionMonth } from './CompletionMonth'
import { CompletionYear } from './CompletionYear'
import { addDays, parseLocalDate } from '../lib/dates'
import {
  completionForDates,
  intensityPct,
  monthCalendar,
  yearCalendar,
  type DayCompletion,
  type ViewMode,
} from '../lib/completion'
import type { Entry, Habit } from '../lib/score'

const DAY_FMT = new Intl.DateTimeFormat('en', { weekday: 'short' })
const TITLE_FMT = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

const TITLES: Record<ViewMode, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
}

const LS_VIEW = 'completion-view'
const LS_COLOR = 'completion-color'
const DEFAULT_COLOR = '#6366F1'
const HEX6 = /^#[0-9a-fA-F]{6}$/

interface Props {
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  today: string
}

function loadStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key)
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode / storage disabled: the choice just doesn't persist.
  }
}

/** Completion card (DESIGN.md §8): day shares of eligible habits that were
 *  done, in three views — week bars, month calendar, year heatmap — all
 *  rendered as a single user-chosen color whose intensity follows the
 *  completion share. View + color persist in localStorage. */
export function CompletionCard({ habits, entriesByHabit, today }: Props) {
  const [view, setView] = useState<ViewMode>(() => loadStored<ViewMode>(LS_VIEW, 'week', VIEWS.map((v) => v.id)))
  // Any hex the native picker produced; validate so a garbled storage value
  // can never poison the CSS color-mix strings.
  const [color, setColor] = useState<string>(() => {
    try {
      const v = localStorage.getItem(LS_COLOR)
      return v && HEX6.test(v) ? v : DEFAULT_COLOR
    } catch {
      return DEFAULT_COLOR
    }
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => store(LS_VIEW, view), [view])
  useEffect(() => store(LS_COLOR, color), [color])

  // Close the palette popover on outside click / Escape.
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  const hasHabits = habits.some((h) => h.created_at <= today)

  // One pass over all three ranges: last 7 days, current month, year grid.
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)),
    [today],
  )
  const monthWeeks = useMemo(() => monthCalendar(today), [today])
  const yearColumns = useMemo(() => yearCalendar(today), [today])
  const allDates = useMemo(() => {
    const set = new Set<string>([
      ...weekDates,
      ...monthWeeks.flat().filter((d): d is string => d != null),
      ...yearColumns.flat(),
    ])
    return [...set].sort()
  }, [weekDates, monthWeeks, yearColumns])

  const byDate = useMemo(() => {
    const map = new Map<string, DayCompletion>()
    for (const d of completionForDates(habits, entriesByHabit, allDates)) map.set(d.date, d)
    return map
  }, [habits, entriesByHabit, allDates])

  return (
    <section
      className={`glass-card fade-up flex h-full flex-col rounded-card p-5 lg:p-6 ${pickerOpen ? 'relative z-10' : ''}`}
      style={{ animationDelay: '40ms' }}
    >
      {/* While the color picker popover is open the card is lifted above its
          siblings: .glass-card stacking contexts (backdrop-filter) at z-auto
          paint in DOM order, so the tile rows below would cover the popover
          where it escapes this card. Same fix as DayStartCard. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-section-title text-fg">{TITLES[view]}</h2>
          <p className="text-caption text-fg-muted">% done per day</p>
        </div>
        <div ref={pickerRef} className="relative flex items-center gap-2">
          <div role="group" aria-label="Completion range" className="glass-pill flex items-center gap-1 rounded-pill p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                className={`relative h-9 rounded-pill px-3 text-caption transition-colors duration-150 after:absolute after:inset-y-[-4px] after:inset-x-1 after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  view === v.id
                    ? 'bg-accent font-medium text-white'
                    : 'text-fg-secondary hover:text-fg'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-label="Change completion color"
            aria-expanded={pickerOpen}
            className="glass-pill relative grid size-11 shrink-0 place-items-center rounded-pill transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <span
              className="size-4 rounded-full border border-white/40"
              style={{ backgroundColor: color }}
            />
          </button>
          {pickerOpen && (
            <div className="glass-card popover-solid absolute right-0 top-[calc(100%+8px)] z-30 w-80 max-w-[calc(100vw-2.5rem)] rounded-card p-4 shadow-xl">
              <ColorPicker
                color={color}
                onChange={(hex) => setColor(hex)}
              />
            </div>
          )}
        </div>
      </div>

      {!hasHabits ? (
        <p className="text-body mt-6 flex-1 text-fg-secondary">
          Check in a habit to see your completion progress.
        </p>
      ) : view === 'week' ? (
        <div className="mt-5 flex flex-1 flex-col">
          <div className="flex min-h-28 flex-1 items-end gap-1.5 sm:gap-2.5">
            {weekDates.map((date, i) => {
              const c = byDate.get(date)
              const frac = c ? c.frac : 0
              const pct = intensityPct(frac)
              const isToday = i === weekDates.length - 1
              const label = `${TITLE_FMT.format(parseLocalDate(date))} — ${c?.done ?? 0} of ${c?.eligible ?? 0} done`
              return (
                <div
                  key={date}
                  role="img"
                  aria-label={label}
                  title={label}
                  className="h-full w-full overflow-hidden rounded-pill bg-fg/10"
                >
                  <div
                    className="bar-in w-full rounded-pill transition-[height] duration-300"
                    style={{
                      height: `${Math.round(frac * 100)}%`,
                      backgroundColor: pct
                        ? `color-mix(in srgb, ${color} ${pct}%, transparent)`
                        : 'transparent',
                      boxShadow: isToday && pct
                        ? `0 0 12px color-mix(in srgb, ${color} 55%, transparent)`
                        : undefined,
                      animationDelay: `${i * 40}ms`,
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {weekDates.map((date, i) => (
              <p
                key={date}
                className={`text-caption text-center ${i === weekDates.length - 1 ? 'text-fg' : 'text-fg-muted'}`}
              >
                {DAY_FMT.format(parseLocalDate(date))}
              </p>
            ))}
          </div>
        </div>
      ) : view === 'month' ? (
        <div className="mt-4 flex min-h-[170px] flex-1 flex-col lg:min-h-0">
          <CompletionMonth weeks={monthWeeks} completions={byDate} color={color} today={today} />
        </div>
      ) : (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <CompletionYear columns={yearColumns} completions={byDate} color={color} today={today} />
        </div>
      )}

      {hasHabits && view !== 'week' && <IntensityLegend color={color} />}
    </section>
  )
}

function IntensityLegend({ color }: { color: string }) {
  const steps = [0.15, 0.4, 0.65, 1].map((f) => intensityPct(f))
  return (
    <div className="mt-3 flex items-center justify-end gap-1.5">
      <span className="text-caption text-fg-muted">Less</span>
      {steps.map((p) => (
        <span
          key={p}
          aria-hidden="true"
          className="size-3.5 rounded-[3px]"
          style={{
            backgroundColor: p
              ? `color-mix(in srgb, ${color} ${p}%, transparent)`
              : 'var(--surface-2)',
          }}
        />
      ))}
      <span className="text-caption text-fg-muted">More</span>
    </div>
  )
}
