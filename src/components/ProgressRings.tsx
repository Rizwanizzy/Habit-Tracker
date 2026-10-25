import { useEffect, useState } from 'react'
import { tint } from '../lib/color'
import { isDone, type Entry, type Habit } from '../lib/score'

const MAX_RINGS = 7
const CENTER = 120
const R_OUTER = 104
const STROKE = 10
const TAU = Math.PI * 2

interface Props {
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  date: string
  caption?: string
}

function fraction(habit: Habit, entry: Entry | undefined): number {
  if (!entry) return 0
  if (habit.type === 'numeric') {
    return Math.max(0, Math.min(1, entry.value / Math.max(1, habit.target)))
  }
  return isDone(habit, entry) ? 1 : 0
}

/** Concentric progress rings (DESIGN.md §6): one per habit in its own color,
 *  outermost = first habit. Stroke 10 with a 6px gap up to 5 rings; with 6–7
 *  rings the pitch shrinks so everything still fits inside the 240-unit square. */
export function ProgressRings({ habits, entriesByHabit, date, caption = 'done today' }: Props) {
  const shown = habits.slice(0, MAX_RINGS)
  // First render draws the rings in over 900ms; afterwards they morph in 700ms.
  const [mounted, setMounted] = useState(false)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    const timer = window.setTimeout(() => setDrawn(true), 900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [])

  const doneCount = shown.filter((h) =>
    isDone(h, (entriesByHabit[h.id] ?? []).find((e) => e.date === date)),
  ).length
  const pitch = shown.length <= 5 ? STROKE + 6 : (R_OUTER - 14) / (shown.length - 1)

  return (
    <div className="relative grid place-items-center">
      <svg
        viewBox="0 0 240 240"
        className="w-full max-w-[240px]"
        role="img"
        aria-label={`${doneCount} of ${shown.length} habits done on ${date}`}
      >
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          {shown.map((habit, i) => {
            const c = habit.color ?? '#3B82F6'
            const r = R_OUTER - pitch * i
            const circumference = TAU * r
            const frac = fraction(habit, (entriesByHabit[habit.id] ?? []).find((e) => e.date === date))
            return (
              <g key={habit.id} fill="none" strokeLinecap="round">
                <circle
                  className="ring-track"
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  stroke={tint(c, 12)}
                  strokeWidth={STROKE}
                />
                <circle
                  className={`ring-progress ${mounted && !drawn ? 'ring-draw' : ''}`}
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  stroke={c}
                  strokeWidth={STROKE}
                  strokeDasharray={circumference}
                  style={{ strokeDashoffset: mounted ? circumference * (1 - frac) : circumference }}
                />
              </g>
            )
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-stat tabular-nums text-fg">
            {doneCount} / {shown.length}
          </p>
          <p className="text-caption text-fg-muted">{caption}</p>
        </div>
      </div>
    </div>
  )
}
