import { Link } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  label: string
  numeral: string
  /** Row of chips/content beneath the numeral (delta chip, habit name line…). */
  children?: ReactNode
  /** Optional node rendered on the SAME row as the numeral (mobile compact
   *  layout); on desktop it falls back to the children row. */
  delta?: ReactNode
  footnote?: string
  /** Position of the card in the fade-up stagger, ms. */
  delay?: number
  /** Optional target — turns the whole tile into a stretched-link drill-in. */
  to?: string
  /** Accessible text for the stretched link (e.g. the habit's name). */
  linkLabel?: string
  /** Compact variant for tight rows (e.g. 3 tiles on a 360px phone). */
  compact?: boolean
}

/** Glass stat tile (DESIGN.md §6): caption label on top, big numeral,
 *  optional chips row and footnote. */
export function StatTile({
  label,
  numeral,
  children,
  delta,
  footnote,
  delay = 0,
  to,
  linkLabel,
  compact = false,
}: Props) {
  // On a phone the compact tile puts the delta on the same row as the numeral;
  // on desktop we keep the original stacked layout (numeral, then delta+name).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 640,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsMobile(mq.matches || window.innerWidth < 640)
    mq.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  const inlineDelta = Boolean(compact && isMobile && delta)
  const pad = compact ? 'p-2 sm:p-5' : 'p-5'
  const labelCls = compact ? 'text-[10px] sm:text-caption' : 'text-caption'
  const numeralCls = compact ? 'text-lg sm:text-stat' : 'text-stat'
  const numeralMt = inlineDelta ? '' : compact ? 'mt-0.5 sm:mt-2' : 'mt-2'
  const rowGap = compact ? 'gap-1 sm:gap-2' : 'gap-2'
  const rowMt = compact ? 'mt-1 sm:mt-3' : 'mt-3'
  const footCls = compact ? 'text-[9px] sm:text-caption mt-0.5 sm:mt-2' : 'text-caption mt-2'

  return (
    <section
      className={`glass-card fade-up group relative rounded-card ${pad}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className={`text-fg-muted ${labelCls}`}>{label}</p>
      {inlineDelta ? (
        <div className={`flex flex-wrap items-baseline gap-2 ${compact ? 'mt-0.5 sm:mt-2' : 'mt-2'}`}>
          <p className={`tabular-nums text-fg ${numeralCls}`}>{numeral}</p>
          <div className="flex items-center">{delta}</div>
        </div>
      ) : (
        <p className={`tabular-nums text-fg ${numeralCls} ${numeralMt}`}>{numeral}</p>
      )}
      {((delta && !inlineDelta) || children) && (
        <div className={`flex flex-wrap items-center ${rowGap} ${rowMt}`}>
          {delta && !inlineDelta && <div className="flex items-center">{delta}</div>}
          {children}
        </div>
      )}
      {footnote && <p className={`text-fg-muted ${footCls}`}>{footnote}</p>}
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
      className="text-[9px] sm:text-caption inline-flex items-center gap-0.5 sm:gap-1 rounded-pill px-1 sm:px-2 py-0.5 sm:py-1 font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-2.5 sm:size-3.5"
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

/** Habit-colored dot (or the habit's emoji) + name in plain text (habit color
 *  never carries text). On tiles that are stretched links (StatTile `to`), the
 *  name underlines on hover for the drill-in affordance. */
export function HabitDotName({
  color,
  name,
  emoji,
  compact = false,
}: {
  color: string
  name: string
  emoji?: string | null
  compact?: boolean
}) {
  return (
    <span className="flex min-w-0 items-center gap-1 sm:gap-2">
      {emoji ? (
        <span aria-hidden="true" className={`shrink-0 leading-none ${compact ? 'text-xs' : 'text-base'}`}>
          {emoji}
        </span>
      ) : (
        <span
          className={`shrink-0 rounded-full ${compact ? 'size-1.5' : 'size-2.5'}`}
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className={`min-w-0 truncate text-fg decoration-1 underline-offset-2 group-hover:underline ${
          compact ? 'text-[10px]' : 'text-body'
        }`}
      >
        {name}
      </span>
    </span>
  )
}
