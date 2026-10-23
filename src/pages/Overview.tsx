import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHabits } from '../hooks/useHabits'
import { useEntries } from '../hooks/useEntries'
import { scoreSeries } from '../lib/score'
import { addDays, todayString } from '../lib/dates'

type RangeKey = '30' | '90' | '365'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '1 year' },
]

const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{ dataKey?: unknown; stroke?: unknown; value?: unknown }>
}

type Row = { date: string; [habitId: string]: string | number | null }

function ScoreTip({
  active,
  label,
  payload,
  names,
}: TipProps & { names: Map<string, string> }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-[10px] border border-border bg-surface-raised px-3 py-2">
      {label !== undefined && <p className="text-caption mb-1 text-fg-muted">{String(label)}</p>}
      {payload.map((entry, i) => {
        const id = String(entry.dataKey ?? '')
        return (
          <p key={i} className="text-caption flex items-center gap-2 text-fg-secondary">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: String(entry.stroke ?? '#3B82F6') }}
            />
            {names.get(id) ?? id}:{' '}
            <span className="font-semibold text-fg">{String(entry.value)}%</span>
          </p>
        )
      })}
    </div>
  )
}

export function Overview() {
  const { habits, loading, error, reload } = useHabits()
  const ids = habits.map((h) => h.id)
  const { entriesByHabit, loading: entriesLoading, error: entriesError } = useEntries(ids, 400)

  const today = todayString()
  const [range, setRange] = useState<RangeKey>('90')
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())

  const names = useMemo(() => new Map(habits.map((h) => [h.id, h.name ?? h.id])), [habits])

  const data = useMemo(() => {
    if (habits.length === 0) return []
    const rows = new Map<string, Row>()
    const start = addDays(today, -(Number(range) - 1))
    for (const habit of habits) {
      const series = scoreSeries(habit, entriesByHabit[habit.id] ?? [], start, today)
      for (const p of series) {
        const row: Row = rows.get(p.date) ?? { date: p.date }
        row[habit.id] = Math.round(p.score * 100)
        rows.set(p.date, row)
      }
    }
    return [...rows.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [habits, entriesByHabit, range, today])

  if (loading || entriesLoading) {
    return (
      <div className="grid place-items-center rounded-card border border-border bg-surface-raised p-10" role="status">
        <span className="text-body text-fg-muted">Loading…</span>
      </div>
    )
  }

  if (error ?? entriesError) {
    const msg = error ?? entriesError
    return (
      <div className="rounded-card border border-danger bg-danger/10 p-6 text-center" role="alert">
        <p className="text-body text-danger">{msg}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-4 h-11 rounded-button border border-danger px-4 text-body font-medium text-danger"
        >
          Retry
        </button>
      </div>
    )
  }

  if (habits.length === 0) {
    return (
      <section>
        <h1 className="text-page-title">Overview</h1>
        <div className="mt-6 rounded-card border border-border bg-surface-raised p-6 text-center">
          <p className="text-body text-fg-secondary">Nothing to show yet.</p>
          <p className="mt-1 text-caption text-fg-muted">
            Charts and stats will appear once you have habits and check-ins.
          </p>
          <Link
            to="/habits/new"
            className="mt-4 inline-flex h-11 items-center rounded-button bg-accent px-4 text-body font-semibold text-white"
          >
            Add habit
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h1 className="text-page-title">Overview</h1>

      {/* Range switch: 30 days / 90 days / 1 year */}
      <div className="mt-4 flex items-center gap-2" role="group" aria-label="Score chart range">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            aria-pressed={range === key}
            className="text-caption h-8 rounded-full px-3 font-medium transition-colors duration-150"
            style={
              range === key
                ? { backgroundColor: 'var(--accent)', color: 'white' }
                : { border: '1.5px solid var(--border)', color: 'var(--text-secondary)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Per-habit toggle chips acting as the chart legend */}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Show or hide habit lines">
        {habits.map((habit) => {
          const color = habit.color ?? '#3B82F6'
          const isOff = hidden.has(habit.id)
          return (
            <button
              key={habit.id}
              type="button"
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev)
                  if (next.has(habit.id)) next.delete(habit.id)
                  else next.add(habit.id)
                  return next
                })
              }
              aria-pressed={!isOff}
              title={habit.name}
              className="text-caption h-8 max-w-[10rem] truncate rounded-full px-3 font-medium transition-colors duration-150"
              style={
                isOff
                  ? { border: `1.5px solid ${color}`, color, opacity: 0.45 }
                  : { backgroundColor: color, color: 'white' }
              }
            >
              {habit.name}
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface-raised p-4">
        <h2 className="text-section-title">Score</h2>
        <p className="mt-1 text-caption text-fg-muted">
          Exponential average per habit — tap a chip to show or hide its line.
        </p>
        <div className="mt-3 h-56">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -22 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => DAY_FMT.format(new Date(`${v}T12:00:00`))}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tickFormatter={(v: number) => (v > 0 ? `${v}%` : '0%')}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={(props: TipProps) => <ScoreTip {...props} names={names} />}
                cursor={{ stroke: 'var(--chart-grid)' }}
              />
              {habits
                .filter((h) => !hidden.has(h.id))
                .map((habit) => (
                  <Line
                    key={habit.id}
                    type="monotone"
                    dataKey={habit.id}
                    stroke={habit.color ?? '#3B82F6'}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}