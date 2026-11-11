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
  /** Phone form rows & compact toolbars: 36px high, 13px text. Omit to get 40px standard control. */
  compact?: boolean
  className?: string
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

/** Segmented range switch (DESIGN.md §6): CSS Grid layout guaranteeing that
 *  every segment occupies exactly 1/N equal width, with an absolute sliding
 *  accent pill sized to match the grid cell boundaries down to the pixel. */
export function RangeSwitch({
  options,
  value,
  onChange,
  ariaLabel,
  compact = false,
  className = '',
}: Props) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  )
  const isNarrow = useNarrowViewport()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative grid rounded-pill border border-border bg-surface p-0.5 select-none ${
        compact ? 'h-8 sm:h-9 min-w-0 sm:min-w-[180px]' : 'h-10 min-w-[200px]'
      } ${className}`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
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
            className={`relative z-10 w-full h-full flex items-center justify-center rounded-pill font-medium text-center transition-colors duration-150 whitespace-nowrap px-2 ${
              compact ? 'text-[13px] leading-none' : 'text-caption'
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
