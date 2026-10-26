import type { Habit } from '../lib/score'

interface Props {
  habit: Habit
  /** "done", "not done", or "3 of 5 min" for numeric habits. */
  status: string
  /** Anchor on the svg box, in percent. */
  x: number
  y: number
  /** Flip side: anchors ABOVE the arc when the arc is in the top half. */
  above: boolean
}

/** Small glass tooltip for the hero rings (DESIGN.md §6): a dot in the
 *  habit's color, the habit name and its status. Shown on hover (desktop)
 *  or a tap (touch, auto-hides after 2s); purely informational. */
export function RingTooltip({ habit, status, x, y, above }: Props) {
  const c = habit.color ?? '#3B82F6'
  return (
    <div
      // Non-interactive: hover/tap stays with the arcs underneath.
      aria-hidden="true"
      className="glass-pill pointer-events-none absolute z-30 whitespace-nowrap rounded-pill px-3 py-1.5"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        // The wrapper is transformed from the anchor; keep the pill exactly
        // above/below it (10px off the arc rim).
        transform: `translate(-50%, ${above ? 'calc(-100% - 10px)' : '10px'})`,
      }}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: c }} />
        <span className="text-caption truncate text-fg">{habit.name}</span>
        <span className="text-caption tabular-nums text-fg-muted">{status}</span>
      </span>
    </div>
  )
}
