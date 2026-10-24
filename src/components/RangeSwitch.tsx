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
}

/** Segmented range switch (DESIGN.md §6): 40px high, 3-column equal-width grid,
 *  with a sliding accent pill sized to exactly one segment. Under 400px uses
 *  short labels (e.g. "30d", "90d", "1y"). */
export function RangeSwitch({ options, value, onChange, ariaLabel }: Props) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  )
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 400

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative flex h-10 items-center rounded-pill border border-border bg-surface p-0.5"
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
            className={`relative z-10 h-[38px] w-full rounded-pill font-medium transition-colors duration-150 whitespace-nowrap items-center justify-center px-2 text-caption ${
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
