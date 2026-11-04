import { useSyncExternalStore } from 'react'

interface Option {
  key: string
  label: string
  /** Short label used when the viewport is under 400px wide. */
  short?: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (key: string) => void
  ariaLabel: string
  /** Phone form rows: 36px high, 13px text, fixed ~170px width. Other
   *  usages omit it and get the original 40px full-width control. */
  compact?: boolean
}

const NARROW_QUERY = '(max-width: 399px)'

function subscribeNarrow(callback: () => void): () => void {
  const mql = window.matchMedia(NARROW_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

/** Reactive narrow-viewport check via matchMedia, so short labels swap live
 *  on resize/rotation instead of waiting for an unrelated re-render. */
function useNarrowViewport(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  )
}

/** Segmented range switch (DESIGN.md §6): 40px high, equal-width segments,
 *  with a sliding accent pill sized to exactly one segment. Under 400px uses
 *  short labels (e.g. "30d", "90d", "1y"). */
export function RangeSwitch({ options, value, onChange, ariaLabel, compact = false }: Props) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  )
  const isNarrow = useNarrowViewport()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative flex items-center rounded-pill border border-border bg-surface p-0.5 ${
        compact ? 'h-9 w-[170px]' : 'h-10'
      }`}
    >
      <span
        aria-hidden="true"
        className="glow-accent absolute inset-y-0.5 left-0.5 rounded-pill bg-accent-gradient transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {options.map((opt, i) => {
        const label = isNarrow && opt.short ? opt.short : opt.label
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={i === idx}
            onClick={() => onChange(opt.key)}
            aria-pressed={i === idx}
            className={`relative z-10 w-full rounded-pill font-medium transition-colors duration-150 whitespace-nowrap items-center justify-center px-2 ${
              compact ? 'h-[34px] text-[13px]' : 'h-[38px] text-caption'
            } ${
              i === idx ? 'text-white' : 'text-fg-secondary hover:text-fg'
            } focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
