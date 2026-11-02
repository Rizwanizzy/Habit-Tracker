import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Heatmap } from '../components/Heatmap'
import { CompletionHistoryChart } from '../components/CompletionHistoryChart'
import { RangeSwitch } from '../components/RangeSwitch'
import { StatTile } from '../components/StatTile'
import { IconChevronLeft, IconPencil } from '../components/icons'
import { useHabitsContext } from '../contexts/HabitsContext'
import { normalizeEmoji } from '../lib/emoji'
import { useEntries } from '../hooks/useEntries'
import {
  bestStreak,
  completionRate,
  currentStreak,
  scoreSeries,
  type Entry,
} from '../lib/score'
import { dayActionFor, nextDayAction } from '../lib/dayStatus'
import { addDays } from '../lib/dates'
import { vacationDatesInRange } from '../lib/vacation'
import { useVacationsContext } from '../contexts/VacationsContext'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { extractError } from '../hooks/useHabits'

const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

/** Honors prefers-reduced-motion: skip Recharts draw-ins (DESIGN.md §9). */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{
    dataKey?: unknown
    value?: unknown
  }>
}

function ScoreTip({
  active,
  label,
  payload,
  name,
  color,
}: TipProps & { name: string; color: string }) {
  if (!active || !payload || payload.length === 0) return null
  // Ignore the wide "glow" halo line (g: prefix).
  const row = payload.find((e) => !String(e.dataKey ?? '').startsWith('g:'))
  if (!row) return null
  return (
    <div className="glass-card rounded-input px-3 py-2">
      <p className="text-body flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-fg-secondary">{name}</span>
        <span className="pl-2 font-semibold tabular-nums text-fg">{String(row.value)}%</span>
      </p>
      {label !== undefined && <p className="text-caption mt-1 text-fg-muted">{String(label)}</p>}
    </div>
  )
}

function upsertEntry(list: Entry[], entry: Entry): Entry[] {
  const i = list.findIndex((e) => e.date === entry.date)
  if (i === -1) return [...list, entry]
  const copy = list.slice()
  copy[i] = entry
  return copy
}

export function HabitDetail() {
  const { id } = useParams()
  const { habits, loading, error, reload } = useHabitsContext()
  const {
    entriesByHabit,
    loading: entriesLoading,
    error: entriesError,
    saveEntry,
    skipEntry,
    removeEntry,
    setEntriesByHabit,
  } = useEntries(id ? [id] : [], 365)

  const today = useLogicalToday()
  const { periods } = useVacationsContext()
  // The 365-day entries window is the widest anything here walks (streaks,
  // 90d score, 30d rate, 18-week calendar): one shared vacation date list.
  const vacations = useMemo(
    () => vacationDatesInRange(periods, addDays(today, -366), today),
    [periods, today],
  )
  const [scoreWindow, setScoreWindow] = useState<'90' | '30'>('90')
  const [actionError, setActionError] = useState<string | null>(null)
  const habit = habits.find((h) => h.id === id)
  const entries = id ? (entriesByHabit[id] ?? []) : []
  const color = habit?.color ?? '#3B82F6'
  const name = habit?.name ?? 'Habit'
  const emoji = normalizeEmoji(habit?.emoji)

  /** Tap cycle on the heatmap (dayStatus helpers): empty → done → skipped →
   *  empty. done upserts status 'done' at target; skipped upserts value 0 /
   *  status 'skipped' (neutral); empty deletes the row. Optimistic with
   *  rollback, same pattern as the Today page check-ins. */
  async function cycleDay(date: string) {
    if (!habit || !id || date > today) return
    setActionError(null)
    const prev = entriesByHabit[id] ?? []
    const existing = prev.find((e) => e.date === date)
    const action = nextDayAction(dayActionFor(habit, existing))
    const value = habit.type === 'numeric' ? habit.target : 1
    const next =
      action === 'done'
        ? upsertEntry(prev, { date, value, status: 'done' })
        : action === 'skipped'
          ? upsertEntry(prev, { date, value: 0, status: 'skipped' })
          : prev.filter((e) => e.date !== date)
    setEntriesByHabit((m) => ({ ...m, [id]: next }))
    try {
      if (action === 'done') await saveEntry(id, date, value)
      else if (action === 'skipped') await skipEntry(id, date)
      else await removeEntry(id, date)
    } catch (e) {
      setEntriesByHabit((m) => ({ ...m, [id]: prev }))
      setActionError(extractError(e))
    }
  }

  /** One row per date; a `g:score` duplicate key feeds the wide glow line the
   *  tooltip filters out, same technique as the Overview chart. */
  const series = useMemo(() => {
    if (!habit) return []
    const start = addDays(today, -(Number(scoreWindow) - 1))
    return scoreSeries(habit, entries, start, today, vacations).map((p) => {
      const score = Math.round(p.score * 100)
      return { date: p.date, score, 'g:score': score }
    })
  }, [habit, entries, today, scoreWindow, vacations])

  if (loading || entriesLoading) {
    return (
      <div className="glass-card grid min-h-40 place-items-center rounded-card p-10" role="status">
        <span className="text-body text-fg-muted">Loading…</span>
      </div>
    )
  }

  if (error ?? entriesError) {
    const msg = error ?? entriesError
    return (
      <div className="glass-card rounded-card p-6 text-center" role="alert">
        <p className="text-body text-danger">{msg}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="glass-pill mt-4 h-12 rounded-pill px-5 text-body font-medium text-fg"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!habit) {
    return (
      <section>
        <h1 className="text-page-title">Habit</h1>
        <div className="glass-card mt-6 rounded-card p-6 text-center">
          <p className="text-body text-fg-secondary">Habit not found.</p>
          <Link to="/" className="text-body mt-4 inline-flex h-11 items-center font-medium text-accent">
            Back to Today
          </Link>
        </div>
      </section>
    )
  }

  const cur = currentStreak(habit, entries, today, vacations)
  const best = bestStreak(habit, entries, vacations)
  const rate = Math.round(completionRate(habit, entries, addDays(today, -29), today, vacations) * 100)

  return (
    <section>
      <header className="flex items-center gap-2">
        <Link
          to="/"
          aria-label="Back to Today"
          className="glass-pill grid size-11 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-150 hover:text-fg"
        >
          <IconChevronLeft className="size-5" />
        </Link>
        {emoji ? (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full text-lg leading-none"
            style={{
              border: `2px solid ${color}`,
              backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            }}
          >
            {emoji}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <h1 className="text-page-title min-w-0 flex-1 truncate">{habit.name}</h1>
        <Link
          to={`/habits/${habit.id}/edit`}
          aria-label={`Edit ${habit.name}`}
          className="glass-pill grid size-11 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-150 hover:text-fg"
        >
          <IconPencil className="size-4" />
        </Link>
      </header>

      {/* Stat tiles: caption on top, big numeral (DESIGN.md §6). */}
      <div className="mt-4 grid grid-cols-3 gap-3 lg:gap-5">
        <StatTile label="Current streak" numeral={String(cur)} />
        <StatTile label="Best streak" numeral={String(best)} delay={40} />
        <StatTile label="30-day rate" numeral={`${rate}%`} delay={80} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        {/* Score chart (DESIGN.md §7): monotone line, gradient area fill in
            the habit color, halo glow, dashed grid, glass tooltip. */}
        <section className="glass-card fade-up rounded-card p-5 lg:p-6" style={{ animationDelay: '120ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-section-title">Score</h2>
            <RangeSwitch
              options={[
                { key: '30', label: '30 days', short: '30d' },
                { key: '90', label: '90 days', short: '90d' },
              ]}
              value={scoreWindow}
              onChange={(k) => setScoreWindow(k as '90' | '30')}
              ariaLabel="Score range"
            />
          </div>
          {series.length === 0 ? (
            <div className="mt-3 grid h-48 place-items-center text-center">
              <p className="text-body text-fg-secondary">Check in a habit to see your score.</p>
            </div>
          ) : (
            <div className="mt-3 h-48">
              <ResponsiveContainer>
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -22 }}>
                  <defs>
                    <linearGradient id={`area-${habit.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => DAY_FMT.format(new Date(`${v}T12:00:00`))}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={(props: TipProps) => <ScoreTip {...props} name={name} color={color} />}
                    cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
                  />
                  <Line
                    key="glow"
                    type="monotone"
                    dataKey="g:score"
                    stroke={color}
                    strokeWidth={9}
                    strokeOpacity={0.18}
                    dot={false}
                    activeDot={false}
                    connectNulls
                    isAnimationActive={false}
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke={color}
                    strokeWidth={2.5}
                    fill={`url(#area-${habit.id})`}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 3, fill: color }}
                    connectNulls
                    isAnimationActive={!REDUCED_MOTION}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Weekly/monthly completion bars (§7) in habit color. */}
        <section className="glass-card fade-up rounded-card p-5 lg:p-6" style={{ animationDelay: '160ms' }}>
          <CompletionHistoryChart habit={habit} entries={entries} />
        </section>
      </div>

      {/* Calendar heatmap full width below (§7). */}
      <section className="glass-card fade-up mt-4 rounded-card p-5 lg:mt-5 lg:p-6" style={{ animationDelay: '200ms' }}>
        <p className="text-section-title">Calendar</p>
        <p className="text-caption mt-1 text-fg-muted">
          Last 18 weeks — cell brightness shows progress toward the daily target; tap a day to cycle
          empty → done → skipped.
        </p>
        <div className="mt-3">
          <Heatmap habit={habit} entries={entries} vacations={vacations} onToggle={(d) => void cycleDay(d)} />
        </div>
        {actionError && (
          <p role="alert" className="mt-3 rounded-input bg-danger/10 px-3 py-2 text-body text-danger">
            {actionError}
          </p>
        )}
      </section>
    </section>
  )
}
