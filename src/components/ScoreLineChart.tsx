import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
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

function ScoreTip({
  active,
  label,
  payload,
  names,
  onIsolate,
}: TipProps & { names: Map<string, string>; onIsolate?: (habitId: string) => void }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const appliedRef = useRef<number | null>(null)

  // Recharts positions the tooltip against the chart box only — its clamp
  // knows nothing about the viewport, so on a phone the bottom of this long
  // tooltip slides under the fixed dock. After Recharts places it, shift our
  // content up just enough to stay fully visible above the dock (with an 8px
  // screen-margin floor). The correction is applied IMPERATIVELY (direct
  // style write — no setState): a state-driven version crashed the whole
  // page with "Maximum update depth exceeded" under continuous pointer
  // events, and DOM-mutation observers jammed the tab in a microtask
  // cascade. The re-checks are therefore a BOUNDED rAF settle loop instead.
  // Measurement subtracts the currently applied shift, so for a given
  // Recharts position the computed shift is a single stable value. Returns
  // the applied shift so the settle loop can detect stability.
  const clamp = useCallback((): number => {
    const el = outerRef.current
    if (!el) return appliedRef.current ?? 0
    const base = appliedRef.current ?? 0
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return base // nothing rendered yet
    const bottom0 = r.bottom - base
    const top0 = r.top - base
    const limit = window.innerHeight - 96 // clear of the fixed mobile dock
    let dy = 0
    if (bottom0 > limit) dy = limit - bottom0
    if (top0 + dy < 8) dy = 8 - top0
    if (dy !== appliedRef.current) {
      appliedRef.current = dy
      el.style.transform = dy ? `translateY(${dy}px)` : ''
    }
    return dy
  }, [])

  // First correction before paint.
  useLayoutEffect(() => {
    clamp()
  })

  // Recharts' own placement and payload hydration can land AFTER the first
  // pass (their measure → translate cycle, late rows), so re-check for a
  // bounded ~0.75s window after every activation/label change, early-exiting
  // once the shift stops changing. Always converges, never recurses.
  useEffect(() => {
    let raf = 0
    let frame = 0
    let stable = 0
    let last = Number.NaN
    const tick = () => {
      const dy = clamp()
      if (dy === last) stable++
      else stable = 0
      last = dy
      frame++
      if (frame < 45 && stable < 6) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, label, clamp])

  // Viewport can change under the tooltip while it is open.
  useEffect(() => {
    const onWin = () => clamp()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [clamp])

  // Ignore the wide "glow" halo lines (g: prefix) — the tooltip shows one row
  // per habit: colored dot, habit name, value.
  const rows = (payload ?? []).filter((e) => !String(e.dataKey ?? '').startsWith('g:'))
  const show = active && rows.length > 0
  return (
    <div ref={outerRef}>
      {show && (
        <div className="glass-card popover-solid rounded-input px-3 py-2 shadow-xl" style={{ maxWidth: 'min(260px, calc(100vw - 1.5rem))' }}>
          {label !== undefined && <p className="text-caption mb-1 text-fg-muted">{String(label)}</p>}
          {rows.map((entry, i) => {
            const id = String(entry.dataKey ?? '')
            const color = String(entry.stroke ?? '#3B82F6')
            return (
              <div
                key={i}
                role={onIsolate ? 'button' : undefined}
                tabIndex={onIsolate ? 0 : undefined}
                onClick={() => onIsolate?.(id)}
                onKeyDown={(e) => {
                  if (onIsolate && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onIsolate(id)
                  }
                }}
                className={`text-body flex items-center gap-2 ${
                  onIsolate ? 'cursor-pointer rounded-xs px-1 -mx-1 transition-colors hover:bg-white/10' : ''
                }`}
                title={onIsolate ? 'Click to isolate' : undefined}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1 truncate text-fg-secondary">{names.get(id) ?? id}</span>
                <span className="pl-2 font-semibold tabular-nums text-fg">{String(entry.value)}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface Props {
  data: ChartRow[]
  visible: Habit[]
  names: Map<string, string>
  onIsolate?: (habitId: string) => void
}

/** Multi-line score chart (DESIGN.md §7): monotone 2.5px strokes in each
 *  habit's color over a wide translucent glow of the same color, horizontal
 *  dashed grid only, no axis lines, 12px axis labels, 8px active dot with a
 *  3px white ring, glass tooltip. */
export function ScoreLineChart({ data, visible, names, onIsolate }: Props) {
  if (data.length === 0) {
    return (
      <div className="grid h-56 max-sm:absolute max-sm:inset-0 max-sm:h-auto place-items-center text-center">
        <p className="text-body text-fg-secondary">Check in a habit to see your score.</p>
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="grid h-56 max-sm:absolute max-sm:inset-0 max-sm:h-auto place-items-center text-center px-4">
        <p className="text-body text-fg-secondary">No habits selected. Choose a habit above to see its trend.</p>
      </div>
    )
  }

  return (
    <div className="h-56 lg:h-64 max-sm:absolute max-sm:inset-0 max-sm:h-auto">
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
            content={(props: TipProps) => <ScoreTip {...props} names={names} onIsolate={onIsolate} />}
            cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 50, maxWidth: 'min(260px, calc(100vw - 1.5rem))' }}
            allowEscapeViewBox={{ x: false, y: false }}
            offset={8}
          />
          {visible.map((habit) => {
            const c = habit.color ?? '#3B82F6'
            return (
              <Line
                key={`glow-${habit.id}`}
                type="monotone"
                dataKey={`g:${habit.id}`}
                stroke={c}
                strokeWidth={9}
                strokeOpacity={0.18}
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
                legendType="none"
                onClick={() => onIsolate?.(habit.id)}
                style={{ cursor: onIsolate ? 'pointer' : undefined }}
              />
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
                onClick={() => onIsolate?.(habit.id)}
                style={{ cursor: onIsolate ? 'pointer' : undefined }}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
