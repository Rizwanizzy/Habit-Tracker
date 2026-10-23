import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Entry, Habit } from '../lib/score'
import { isDone } from '../lib/score'
import { addDays, parseLocalDate, todayString } from '../lib/dates'

type Range = 'week' | 'month'
type Bucket = { label: string; count: number }

const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const MONTH_FMT = new Intl.DateTimeFormat('en', { month: 'short' })

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{ value?: unknown }>
}

function CompletionTip({ active, label, payload }: TipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-[10px] border border-border bg-surface-raised px-3 py-2">
      <p className="text-caption text-fg-secondary">
        Week of {String(label)}: <span className="font-semibold text-fg">{String(payload[0].value)}</span> completions
      </p>
    </div>
  )
}

function completedInWeek(habit: Habit, byDate: Map<string, Entry>, start: string, today: string): number {
  let count = 0
  for (let d = 0; d < 7; d++) {
    const date = addDays(start, d)
    if (date > today) break
    if (isDone(habit, byDate.get(date))) count++
  }
  return count
}

function weeklyBuckets(habit: Habit, entries: Entry[]): Bucket[] {
  const today = todayString()
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const lastSunday = addDays(today, -parseLocalDate(today).getDay())
  const out: Bucket[] = []
  for (let i = 7; i >= 0; i--) {
    const start = addDays(lastSunday, -i * 7)
    out.push({ label: DAY_FMT.format(parseLocalDate(start)), count: completedInWeek(habit, byDate, start, today) })
  }
  return out
}

function monthlyBuckets(habit: Habit, entries: Entry[]): Bucket[] {
  const now = parseLocalDate(todayString())
  const out: Bucket[] = []
  for (let k = 5; k >= 0; k--) {
    const start = new Date(now.getFullYear(), now.getMonth() - k, 1)
    const y = start.getFullYear()
    const m = start.getMonth()
    const count = entries.filter((e) => {
      const d = parseLocalDate(e.date)
      return d.getFullYear() === y && d.getMonth() === m && isDone(habit, e)
    }).length
    out.push({ label: MONTH_FMT.format(start), count })
  }
  return out
}

/** Weekly/monthly completion bar chart, toggleable via habit-colored chips. */
export function CompletionHistoryChart({ habit, entries }: { habit: Habit; entries: Entry[] }) {
  const [range, setRange] = useState<Range>('week')
  const color = habit.color ?? '#3B82F6'

  const data = useMemo(
    () => (range === 'week' ? weeklyBuckets(habit, entries) : monthlyBuckets(habit, entries)),
    [range, habit, entries],
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-section-title">History</h3>
        <div className="flex gap-2" role="group" aria-label="History range">
          {(['week', 'month'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className="text-caption h-7 rounded-full px-3 font-medium capitalize"
              style={
                range === r
                  ? { backgroundColor: color, color: 'white' }
                  : { border: `1.5px solid ${color}`, color }
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-caption text-fg-muted">No check-ins yet.</p>
      ) : (
        <div className="mt-3 h-52">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 18, right: 8, left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                interval={0}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={48}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={CompletionTip} cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }} />
              <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} maxBarSize={28}>
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}