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
import { dayStatus, isNeutral } from '../lib/dayStatus'
import { addDays, parseLocalDate } from '../lib/dates'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { tint } from '../lib/color'
import type { ScheduleEpoch } from '../lib/schedule'
import { weekStart, weekEnd, resolveEpoch, isTransitionWeek, isValidWeeklyTarget } from '../lib/schedule'

type Range = 'week' | 'month'
type Bucket = { label: string; count: number; total?: number }

/** Honors prefers-reduced-motion: skip Recharts draw-ins (DESIGN.md §9). */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
  const value = payload[0].value as number
  const total = (payload[0] as { payload?: { total?: number } }).payload?.total
  return (
    <div className="glass-card rounded-input px-3 py-2">
      <p className="text-body flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-fg-secondary">{range === 'week' ? `Week of ${String(label)}` : String(label)}</span>
        <span className="pl-2 font-semibold tabular-nums text-fg">
          {total !== undefined && total > 0 ? `${value} / ${total}` : String(value)}
        </span>
      </p>
    </div>
  )
}

function weeklyBuckets(
  habit: Habit,
  entries: Entry[],
  today: string,
  vacations: readonly string[],
  epochs?: readonly ScheduleEpoch[],
): Bucket[] {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const lastSunday = addDays(today, -parseLocalDate(today).getDay())
  const out: Bucket[] = []

  // Check if this is a weekly_target habit with epochs
  const currentEpoch = epochs?.length ? resolveEpoch(epochs, today) : undefined
  const isWeeklyTarget = currentEpoch?.schedule_type === 'weekly_target' && isValidWeeklyTarget(currentEpoch.weekly_target ?? 0)

  for (let i = 7; i >= 0; i--) {
    const start = addDays(lastSunday, -i * 7)

    if (isWeeklyTarget && epochs) {
      // Weekly-target: check if this week is achieved
      const weekEpoch = resolveEpoch(epochs, start)
      if (weekEpoch?.schedule_type === 'weekly_target' && !isTransitionWeek(epochs, start) && start >= habit.created_at) {
        const target = weekEpoch.weekly_target ?? 0
        let done = 0
        for (let d = 0; d < 7; d++) {
          const date = addDays(start, d)
          if (date > today) break
          if (isDone(habit, byDate.get(date))) done++
        }
        const achieved = done >= target
        out.push({ label: DAY_FMT.format(parseLocalDate(start)), count: achieved ? 1 : 0, total: 1 })
      } else {
        // Transition week or before habit creation - neutral
        out.push({ label: DAY_FMT.format(parseLocalDate(start)), count: 0, total: 0 })
      }
    } else {
      // Daily/weekdays/interval/legacy: count eligible days completed
      let eligible = 0
      let done = 0
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, d)
        if (date > today) break
        const status = dayStatus({ habit, date, entry: byDate.get(date), today, vacations, schedule: epochs })
        if (!isNeutral(status)) {
          eligible++
          if (status === 'done') done++
        }
      }
      out.push({ label: DAY_FMT.format(parseLocalDate(start)), count: done, total: eligible })
    }
  }
  return out
}

function monthlyBuckets(
  habit: Habit,
  entries: Entry[],
  today: string,
  vacations: readonly string[],
  epochs?: readonly ScheduleEpoch[],
): Bucket[] {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const now = parseLocalDate(today)
  const out: Bucket[] = []

  // Check if this is a weekly_target habit with epochs
  const currentEpoch = epochs?.length ? resolveEpoch(epochs, today) : undefined
  const isWeeklyTarget = currentEpoch?.schedule_type === 'weekly_target' && isValidWeeklyTarget(currentEpoch.weekly_target ?? 0)

  for (let k = 5; k >= 0; k--) {
    const start = new Date(now.getFullYear(), now.getMonth() - k, 1)
    const y = start.getFullYear()
    const m = start.getMonth()
    const end = new Date(y, m + 1, 0) // last day of month
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)

    if (isWeeklyTarget && epochs) {
      // Weekly-target: count achieved weeks in this month
      let achievedWeeks = 0
      let totalWeeks = 0
      // Iterate through each week (Monday-Sunday) in the month
      let weekStartDate = weekStart(startStr)

      while (weekStartDate <= endStr) {
        const weekEndDate = weekEnd(weekStartDate)
        // Check if this week falls in the month
        if (weekStartDate >= startStr && weekEndDate <= endStr) {
          const weekEpoch = resolveEpoch(epochs, weekStartDate)
          if (weekEpoch?.schedule_type === 'weekly_target' && !isTransitionWeek(epochs, weekStartDate) && weekStartDate >= habit.created_at) {
            totalWeeks++
            let done = 0
            for (let d = 0; d < 7; d++) {
              const date = addDays(weekStartDate, d)
              if (date > today) break
              if (isDone(habit, byDate.get(date))) done++
            }
            if (done >= (weekEpoch.weekly_target ?? 0)) achievedWeeks++
          }
        }
        weekStartDate = addDays(weekStartDate, 7)
      }
      out.push({ label: MONTH_FMT.format(start), count: achievedWeeks, total: totalWeeks })
    } else {
      // Daily/weekdays/interval/legacy: count eligible days completed in month
      let eligible = 0
      let done = 0
      for (let d = 0; d <= end.getDate(); d++) {
        const date = new Date(y, m, d + 1).toISOString().slice(0, 10)
        if (date > today) break
        if (date < habit.created_at) continue
        const status = dayStatus({ habit, date, entry: byDate.get(date), today, vacations, schedule: epochs })
        if (!isNeutral(status)) {
          eligible++
          if (status === 'done') done++
        }
      }
      out.push({ label: MONTH_FMT.format(start), count: done, total: eligible })
    }
  }
  return out
}

/** Weekly/monthly completion bars (DESIGN.md §7): 10px habit-color bars with
 *  fully rounded tops; the latest (current) bucket glows. */
export function CompletionHistoryChart({
  habit,
  entries,
  vacations = [],
  epochs,
}: { habit: Habit; entries: Entry[]; vacations?: readonly string[]; epochs?: readonly ScheduleEpoch[] }) {
  const [range, setRange] = useState<Range>('week')
  const today = useLogicalToday()
  const color = habit.color ?? '#3B82F6'

  const data = useMemo(
    () =>
      range === 'week'
        ? weeklyBuckets(habit, entries, today, vacations, epochs)
        : monthlyBuckets(habit, entries, today, vacations, epochs),
    [range, habit, entries, today, vacations, epochs],
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
                className="text-body relative flex h-9 items-center rounded-pill px-4 font-medium capitalize transition-all duration-150 after:absolute after:inset-x-0 after:inset-y-[-4px] after:content-['']"
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
              <Bar dataKey="count" fill={color} barSize={10} radius={[5, 5, 0, 0]} isAnimationActive={!REDUCED_MOTION}>
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
