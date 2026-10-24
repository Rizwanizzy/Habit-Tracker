import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Entry, Habit } from '../lib/score'
import { isDone } from '../lib/score'
import { addDays, parseLocalDate, todayString } from '../lib/dates'
import { tint } from '../lib/color'

type Range = 'week' | 'month'
type Bucket = { label: string; count: number }

const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const MONTH_FMT = new Intl.DateTimeFormat('en', { month: 'short' })

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{ value?: unknown }>
}

function CompletionTip({
  active,
  label,
  payload,
  range,
  color,
}: TipProps & { range: Range; color: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="glass-card rounded-input px-3 py-2">
      <p className="text-body flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-fg-secondary">{range === 'week' ? `Week of ${String(label)}` : String(label)}</span>
        <span className="pl-2 font-semibold tabular-nums text-fg">{String(payload[0].value)}</span>
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

/** Weekly/monthly completion bars (DESIGN.md §7): 10px habit-color bars with
 *  fully rounded tops; the latest (current) bucket glows. */
export function CompletionHistoryChart({ habit, entries }: { habit: Habit; entries: Entry[] }) {
  const [range, setRange] = useState<Range>('week')
  const color = habit.color ?? '#3B82F6'

  const data = useMemo(
    () => (range === 'week' ? weeklyBuckets(habit, entries) : monthlyBuckets(habit, entries)),
    [range, habit, entries],
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-section-title">History</h3>
        <div className="flex gap-2" role="group" aria-label="History range">
          {(['week', 'month'] as const).map((r) => {
            const on = range === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={on}
                title={r === 'week' ? 'Weekly totals' : 'Monthly totals'}
                className="text-body flex h-9 items-center rounded-pill px-4 font-medium capitalize transition-all duration-150"
                style={
                  on
                    ? { backgroundColor: tint(color, 20), border: `1px solid ${tint(color, 40)}` }
                    : { opacity: 0.5, border: '1px solid var(--border)' }
                }
              >
                {r}
              </button>
            )
          })}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-body text-fg-secondary">No check-ins yet.</p>
      ) : (
        <div className="mt-3 h-52">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 18, right: 8, left: -20 }} barCategoryGap="24%">
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                interval={0}
                tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={44}
                tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }}
                content={(props: TipProps) => <CompletionTip {...props} range={range} color={color} />}
              />
              <Bar dataKey="count" fill={color} barSize={10} radius={[5, 5, 0, 0]}>
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    style={
                      i === data.length - 1
                        ? { filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 60%, transparent))` }
                        : undefined
                    }
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
