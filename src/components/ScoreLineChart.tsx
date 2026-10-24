import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Habit } from '../lib/score'

export type ChartRow = { date: string; [key: string]: string | number | null }

/** Honors prefers-reduced-motion: skip Recharts draw-ins (DESIGN.md §9). */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{
    dataKey?: unknown
    stroke?: unknown
    value?: unknown
  }>
}

function ScoreTip({ active, label, payload, names }: TipProps & { names: Map<string, string> }) {
  if (!active || !payload || payload.length === 0) return null
  // Ignore the wide "glow" halo lines (g: prefix) — the tooltip shows one row
  // per habit: colored dot, habit name, value.
  const rows = payload.filter((e) => !String(e.dataKey ?? '').startsWith('g:'))
  if (rows.length === 0) return null
  return (
    <div className="glass-card rounded-input px-3 py-2">
      {label !== undefined && <p className="text-caption mb-1 text-fg-muted">{String(label)}</p>}
      {rows.map((entry, i) => {
        const id = String(entry.dataKey ?? '')
        const color = String(entry.stroke ?? '#3B82F6')
        return (
          <p key={i} className="text-body flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="min-w-0 flex-1 truncate text-fg-secondary">{names.get(id) ?? id}</span>
            <span className="pl-2 font-semibold tabular-nums text-fg">{String(entry.value)}%</span>
          </p>
        )
      })}
    </div>
  )
}

interface Props {
  data: ChartRow[]
  visible: Habit[]
  names: Map<string, string>
}

/** Multi-line score chart (DESIGN.md §7): monotone 2.5px strokes in each
 *  habit's color over a wide translucent glow of the same color, horizontal
 *  dashed grid only, no axis lines, 12px axis labels, 8px active dot with a
 *  3px white ring, glass tooltip. */
export function ScoreLineChart({ data, visible, names }: Props) {
  if (data.length === 0) {
    return (
      <div className="grid h-56 place-items-center text-center">
        <p className="text-body text-fg-secondary">Check in a habit to see your score.</p>
      </div>
    )
  }
  return (
    <div className="h-56 lg:h-64">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -22 }}>
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
            content={(props: TipProps) => <ScoreTip {...props} names={names} />}
            cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
          />
          {visible.map((habit) => {
            const c = habit.color ?? '#3B82F6'
            return (
              <Line key={`glow-${habit.id}`} type="monotone" dataKey={`g:${habit.id}`} stroke={c} strokeWidth={9} strokeOpacity={0.18} dot={false} activeDot={false} connectNulls isAnimationActive={false} legendType="none" />
            )
          })}
          {visible.map((habit) => {
            const c = habit.color ?? '#3B82F6'
            return (
              <Line
                key={habit.id}
                type="monotone"
                dataKey={habit.id}
                stroke={c}
                strokeWidth={2.5}
                strokeDasharray="0"
                dot={false}
                activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 3, fill: c }}
                connectNulls
                isAnimationActive={!REDUCED_MOTION}
                animationDuration={900}
                legendType="none"
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
