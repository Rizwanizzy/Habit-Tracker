import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { tint } from '../lib/color'
import { isDone, type Entry, type Habit } from '../lib/score'
import { dayStatus, isNeutral } from '../lib/dayStatus'
import { layoutRings, ringGeometry, segmentArcs } from '../lib/rings'
import { RingTooltip } from './RingTooltip'

interface Props {
  /** Ordered ACTIVE habits from the shared list (rule 8 — never re-sorted here). */
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  date: string
  caption?: string
  /** Vacation mode: the center numeral area shows "Paused" instead of the
   *  done/total pair (used on the Today hero while today is a vacation day). */
  paused?: boolean
  /** Concrete vacation dates in the stats window (dayStatus neutrality). */
  vacations?: readonly string[]
}

function formatNumber(n: number): string {
  return Number.isFinite(n) ? String(n) : '0'
}

function fraction(habit: Habit, entry: Entry | undefined): number {
  // A skipped row's value (0) is never a progress value.
  if (!entry || entry.status === 'skipped') return 0
  if (habit.type === 'numeric') {
    return Math.max(0, Math.min(1, entry.value / Math.max(1, habit.target)))
  }
  return isDone(habit, entry) ? 1 : 0
}

function statusText(habit: Habit, entry: Entry | undefined, vacationDay: boolean): string {
  if (entry?.status === 'skipped') return 'skipped'
  // Done wins on a vacation day; the pause only forgives misses.
  if (vacationDay && !(entry !== undefined && isDone(habit, entry))) return 'vacation'
  if (habit.type === 'numeric') {
    const v = entry?.value ?? 0
    return `${formatNumber(v)} of ${formatNumber(habit.target)}${habit.unit ? ` ${habit.unit}` : ''}`
  }
  return entry && isDone(habit, entry) ? 'done' : 'not done'
}

interface Row {
  habit: Habit
  radius: number
  width: number
  /** start/end angle of the habit's slice; undefined = full circle (single-habit ring). */
  arc?: { startAngle: number; endAngle: number }
}

/** Concentric progress rings for the Today hero (DESIGN.md §6). Ring order
 *  follows habit order from the outside in, exactly as layoutRings returns
 *  it (shared split rings outside, full rings inside when > 7 habits).
 *  Every habit's arcs are keyed by habit id at the top level of the SVG, so
 *  a reorder/add smoothly morphs radius (r), position (rotation), and fill
 *  (stroke-dasharray) instead of remounting. The SVG-based pointer picker
 *  (nearest arc by polar distance) is the hit area — no per-arc listeners,
 *  and tapping never toggles anything. */
export function ProgressRings({ habits, entriesByHabit, date, caption = 'done today', paused = false, vacations = [] }: Props) {
  // First render draws the rings in over 900ms; afterwards they morph in 400ms.
  const [mounted, setMounted] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const [tipId, setTipId] = useState<string | null>(null)
  const tipTimer = useRef<number | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    const timer = window.setTimeout(() => setDrawn(true), 900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => () => { if (tipTimer.current !== null) window.clearTimeout(tipTimer.current) }, [])

  const layout = useMemo(() => layoutRings(habits.map((h) => h.id)), [habits])
  const numRings = layout.rings.length
  // ringGeometry packs sharp-edged rings between a ≥96px center hole and the
  // rim of the 240-unit box (hole shrinks as rings are added; strokes thin
  // from ~12px for few rings to ~8.5px at 7). No need to grow the viewBox.
  const size = 240
  const geo = useMemo(() => ringGeometry(size, numRings), [size, numRings])
  const C = size / 2

  const byId = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits])
  const rows = useMemo(() => {
    const list: Row[] = []
    layout.rings.forEach((ring, ringIndex) => {
      // layoutRings is outermost-first; ringGeometry is innermost-first.
      const g = geo.rings[numRings - 1 - ringIndex]
      if (!g) return
      const multi = ring.habitIds.length > 1
      const arcs = multi ? segmentArcs(g.radius, ring.habitIds.length) : []
      ring.habitIds.forEach((id, i) => {
        const habit = byId.get(id)
        if (!habit) return
        list.push({ habit, radius: g.radius, width: g.width, arc: multi ? arcs[i] : undefined })
      })
    })
    return list
  }, [layout, geo, numRings, byId])

  // Center totals count ALL active habits — not just the ones on the rings
  // and not only those within the 28-habit rings cap. A skipped habit is
  // excluded from the total (neutral day, never a 0% miss); days before a
  // habit's start keep counting as empty rings (old behavior).
  const total = habits.filter(
    (h) =>
      !isNeutral(
        dayStatus({
          habit: h,
          date,
          entry: (entriesByHabit[h.id] ?? []).find((e) => e.date === date),
          today: date,
          vacations,
        }),
      ),
  ).length
  const done = habits.filter((h) =>
    isDone(h, (entriesByHabit[h.id] ?? []).find((e) => e.date === date)),
  ).length

  function clearTip() {
    if (tipTimer.current !== null) window.clearTimeout(tipTimer.current)
    tipTimer.current = null
    setTipId(null)
  }

  /** Hover/tap targeting: pick the arc nearest to the pointer in polar
   *  coordinates (ring by radius, habit by slice angle), with a generous
   *  ~24px tolerance so thin shared arcs are easy to hit. */
  function pick(e: ReactPointerEvent<SVGSVGElement>): string | null {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rows.length === 0) return null
    const scale = size / rect.width
    const px = (e.clientX - rect.left) * scale
    const py = (e.clientY - rect.top) * scale
    const r = Math.hypot(px - C, py - C)
    const tolerance = Math.max(24 * scale, geo.rings[0]?.width ?? 0)
    let bestRing = -1
    let bestDist = Infinity
    for (let i = 0; i < numRings; i++) {
      const d = Math.abs(r - (geo.rings[i]?.radius ?? 0))
      if (d < bestDist) {
        bestDist = d
        bestRing = numRings - 1 - i // back to layout order (outermost first)
      }
    }
    if (bestRing === -1 || bestDist > tolerance) return null
    let angle = Math.atan2(py - C, px - C)
    if (angle < -Math.PI / 2) angle += 2 * Math.PI
    const ring = layout.rings[bestRing]
    if (!ring || ring.habitIds.length < 2) {
      return ring?.habitIds[0] ?? null
    }
    const g = geo.rings[numRings - 1 - bestRing]
    const arcs = g ? segmentArcs(g.radius, ring.habitIds.length) : []
    const idx = arcs.findIndex((a) => angle >= a.startAngle && angle < a.endAngle)
    return idx >= 0 ? (ring.habitIds[idx] ?? null) : null
  }

  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'touch') return
    setTipId(pick(e))
  }

  function onDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'touch') return
    const id = pick(e)
    setTipId(id)
    if (tipTimer.current !== null) window.clearTimeout(tipTimer.current)
    tipTimer.current = id ? window.setTimeout(() => setTipId(null), 2000) : null
  }

  const tip = tipId ? (byId.get(tipId) ?? null) : null
  const tipRow = tip ? rows.find((row) => row.habit.id === tip.id) : undefined
  // Numeral scales to the shrinking center: full size when roomy, smaller
  // for many-digit totals, smallest when 6–7 rings leave a 96px-ish hole.
  const compact = total > 9 || numRings > 3
  const numeralSize = numRings > 5 ? '1.35rem' : compact ? '1.5rem' : undefined
  const showCaption = numRings <= 5

  return (
    <div className="relative grid place-items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[240px]"
        style={{ touchAction: 'pan-y' }}
        role="img"
        aria-label={`${done} of ${total} habits done on ${date}`}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerLeave={clearTip}
        onPointerCancel={clearTip}
      >
        {rows.map(({ habit, radius, width, arc }) => {
          const c = habit.color ?? '#3B82F6'
          const entry = (entriesByHabit[habit.id] ?? []).find((e) => e.date === date)
          const frac = fraction(habit, entry)
          const circ = 2 * Math.PI * radius
          const label = `${habit.name}: ${statusText(habit, entry, vacations.includes(date))}`
          const drawClass = mounted && !drawn ? 'ring-draw' : ''

          if (!arc) {
            // Single-habit ring: a full circle, exactly as before.
            return (
              <g key={habit.id} aria-label={label} fill="none" strokeLinecap="round">
                <circle className="ring-track" cx={C} cy={C} r={radius} stroke={tint(c, 12)} strokeWidth={width} />
                <circle
                  className={`ring-progress ${drawClass}`}
                  cx={C}
                  cy={C}
                  r={radius}
                  stroke={c}
                  strokeWidth={width}
                  strokeDasharray={circ}
                  style={{ strokeDashoffset: mounted ? circ * (1 - frac) : circ }}
                />
              </g>
            )
          }

          // Shared ring: equal arcs with 6px gaps from segmentArcs. Painted
          // dashes are trimmed at both ends by half a stroke so round caps
          // keep a visible gap between neighbours. Position = rotation
          // (morphs on reorder), fill = dash length (morphs on check-in).
          const arcLen = (arc.endAngle - arc.startAngle) * radius
          const capTrim = Math.min(arcLen / 4, width / 2 + 1)
          const paintLen = Math.max(1, arcLen - 2 * capTrim)
          const deg = (arc.startAngle * 180) / Math.PI + 90
          const rotate = { transform: `rotate(${deg}deg)` }
          return (
            <g key={habit.id} aria-label={label} fill="none" strokeLinecap="round">
              <circle
                className="ring-track ring-arc"
                cx={C}
                cy={C}
                r={radius}
                stroke={tint(c, 12)}
                strokeWidth={width}
                strokeDasharray={`${paintLen} ${circ - paintLen}`}
                style={rotate}
              />
              <circle
                className={`ring-progress ring-arc ${drawClass}`}
                cx={C}
                cy={C}
                r={radius}
                stroke={c}
                strokeWidth={width}
                strokeDasharray={mounted ? `${paintLen * frac} ${circ - paintLen * frac}` : `0 ${circ}`}
                style={{ ...rotate, opacity: frac > 0 ? 1 : 0 }}
              />
            </g>
          )
        })}
      </svg>

      {/* Center: totals over all active habits; numeral shrinks when the
          inner ring is tight, caption hidden when it would not fit. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-stat tabular-nums text-fg" style={numeralSize ? { fontSize: numeralSize } : undefined}>
            {paused ? <span className="text-body font-semibold">Paused</span> : (
              <>
                {done} / {total}
              </>
            )}
          </p>
          {showCaption && <p className="text-caption text-fg-muted">{caption}</p>}        </div>
      </div>

      {tip &&
        tipRow &&
        (() => {
          const arc = tipRow.arc
          const mid =
            arc == null
              ? -Math.PI / 2
              : (arc.startAngle + arc.endAngle) / 2
          const tipR = tipRow.radius + tipRow.width
          const x = C + tipR * Math.cos(mid)
          const y = C + tipR * Math.sin(mid)
          return (
            <RingTooltip
              habit={tip}
              status={statusText(tip, (entriesByHabit[tip.id] ?? []).find((e) => e.date === date), vacations.includes(date))}
              x={(x / size) * 100}
              y={(y / size) * 100}
              above={y < C}
            />
          )
        })()}
    </div>
  )
}
