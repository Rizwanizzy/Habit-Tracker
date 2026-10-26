import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Props {
  label: string
  numeral: string
  /** Row of chips/content beneath the numeral (delta chip, habit name line…). */
  children?: ReactNode
  footnote?: string
  /** Position of the card in the fade-up stagger, ms. */
  delay?: number
  /** Optional target — turns the whole tile into a stretched-link drill-in. */
  to?: string
  /** Accessible text for the stretched link (e.g. the habit's name). */
  linkLabel?: string
}

/** Glass stat tile (DESIGN.md §6): caption label on top, big numeral,
 *  optional chips row and footnote. */
export function StatTile({ label, numeral, children, footnote, delay = 0, to, linkLabel }: Props) {
  return (
    <section className="glass-card fade-up group relative rounded-card p-5" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-caption text-fg-muted">{label}</p>
      <p className="text-stat mt-2 tabular-nums text-fg">{numeral}</p>
      {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
      {footnote && <p className="text-caption mt-2 text-fg-muted">{footnote}</p>}
      {to && (
        <Link
          to={to}
          aria-label={linkLabel ?? 'Open details'}
          className="absolute inset-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="sr-only">{linkLabel ?? 'Open details'}</span>
        </Link>
      )}
    </section>
  )
}

const TONES = {
  success: 'var(--success)',
  danger: 'var(--danger)',
} as const

/** Small delta chip with an arrow (success or danger tone). */
export function DeltaChip({
  direction,
  text,
  tone,
}: {
  direction: 'up' | 'down'
  text: string
  tone: keyof typeof TONES
}) {
  const color = TONES[tone]
  return (
    <span
      className="text-caption inline-flex items-center gap-1 rounded-pill px-2 py-1 font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === 'up' ? <path d="M12 19V5m-7 7 7-7 7 7" /> : <path d="M12 5v14m7-7-7 7-7-7" />}
      </svg>
      {text}
    </span>
  )
}

/** Habit-colored dot + name in plain text (habit color never carries text).
 *  On tiles that are stretched links (StatTile `to`), the name underlines on
 *  hover for the drill-in affordance. */
export function HabitDotName({ color, name }: { color: string; name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-body min-w-0 truncate text-fg decoration-1 underline-offset-2 group-hover:underline">
        {name}
      </span>
    </span>
  )
}
