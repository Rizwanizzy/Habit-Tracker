import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Heatmap } from '../components/Heatmap'
import { CompletionHistoryChart } from '../components/CompletionHistoryChart'
import { useHabits } from '../hooks/useHabits'
import { useEntries } from '../hooks/useEntries'
import { bestStreak, completionRate, currentStreak, scoreSeries } from '../lib/score'
import { addDays, todayString } from '../lib/dates'

const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{ value?: unknown }>
}

function ScoreTip({ active, label, payload }: TipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-[10px] border border-border bg-surface-raised px-3 py-2">
      <p className="text-caption text-fg-secondary">
        {String(label)}: <span className="font-semibold text-fg">{String(payload[0].value)}%</span> score
      </p>
    </div>
  )
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface-raised p-4 text-center">
      <p className="text-stat truncate">{value}</p>
      <p className="text-caption mt-1 text-fg-muted">{label}</p>
    </div>
  )
}

export function HabitDetail() {
  const { id } = useParams()
  const { habits, loading, error, reload } = useHabits({ includeArchived: true })
  const {
    entriesByHabit,
    loading: entriesLoading,
    error: entriesError,
  } = useEntries(id ? [id] : [], 365)

  const today = todayString()
  const [scoreWindow, setScoreWindow] = useState<'90' | '30'>('90')
  const habit = habits.find((h) => h.id === id)
  const entries = id ? (entriesByHabit[id] ?? []) : []
  const color = habit?.color ?? '#3B82F6'

  const series = useMemo(() => {
    if (!habit) return []
    const start = addDays(today, -(Number(scoreWindow) - 1))
    return scoreSeries(habit, entries, start, today).map((p) => ({
      date: p.date,
      score: Math.round(p.score * 100),
    }))
  }, [habit, entries, today, scoreWindow])

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

  if (!habit) {
    return (
      <section>
        <h1 className="text-page-title">Habit</h1>
        <div className="mt-6 rounded-card border border-border bg-surface-raised p-6 text-center">
          <p className="text-body text-fg-secondary">Habit not found.</p>
          <Link to="/" className="mt-4 inline-block text-body font-medium text-accent">
            Back to Today
          </Link>
        </div>
      </section>
    )
  }

  const cur = currentStreak(habit, entries, today)
  const best = bestStreak(habit, entries)
  const rate = Math.round(completionRate(habit, entries, addDays(today, -29), today) * 100)

  return (
    <section>
      <header className="flex items-center gap-1">
        <Link
          to="/"
          aria-label="Back to Today"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-150 hover:bg-surface hover:text-fg"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-page-title min-w-0 flex-1 truncate">{habit.name}</h1>
        <Link
          to={`/habits/${habit.id}/edit`}
          aria-label={`Edit ${habit.name}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-150 hover:bg-surface hover:text-fg"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </Link>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatTile value={String(cur)} label="Current streak" />
        <StatTile value={String(best)} label="Best streak" />
        <StatTile value={`${rate}%`} label="30-day rate" />
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface-raised p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-section-title">Score</h2>
          <div className="flex gap-2" role="group" aria-label="Score range">
            {(['30', '90'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setScoreWindow(w)}
                aria-pressed={scoreWindow === w}
                className="text-caption h-7 rounded-full px-3 font-medium"
                style={
                  scoreWindow === w
                    ? { backgroundColor: color, color: 'white' }
                    : { border: `1.5px solid ${color}`, color }
                }
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 h-48">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -22 }}>
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
              <Tooltip content={ScoreTip} cursor={{ stroke: 'var(--chart-grid)' }} />
              <Area
                type="monotone"
                dataKey="score"
                stroke={color}
                strokeWidth={2.5}
                fill={color}
                fillOpacity={0.08}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface-raised p-4">
        <CompletionHistoryChart habit={habit} entries={entries} />
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface-raised p-4">
        <h2 className="text-section-title">Calendar</h2>
        <p className="mt-1 text-caption text-fg-muted">Last 18 weeks — intensity shows progress toward target.</p>
        <div className="mt-3">
          <Heatmap habit={habit} entries={entries} />
        </div>
      </div>
    </section>
  )
}