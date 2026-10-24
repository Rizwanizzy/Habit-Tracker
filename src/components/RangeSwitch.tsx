interface Option {
  key: string
  label: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (key: string) => void
  ariaLabel: string
  /** Smaller caption-size text, for 4-option switches (e.g. Gender). */
  dense?: boolean
}

/** Segmented range switch (DESIGN.md §6): 36px high, glass track, with a
 *  sliding accent-gradient pill behind the active option. */
export function RangeSwitch({ options, value, onChange, ariaLabel, dense }: Props) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  )
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="relative flex h-9 items-center rounded-pill border border-border bg-surface p-0.5"
    >
      <span
        aria-hidden="true"
        className="glow-accent absolute inset-y-0.5 left-0.5 rounded-pill bg-accent-gradient transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {options.map((opt, i) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          aria-pressed={i === idx}
          className={`relative z-10 h-8 flex-1 rounded-pill font-medium transition-colors duration-150 after:absolute after:inset-x-0 after:inset-y-[-6px] after:content-[''] ${
            dense ? 'text-caption px-1' : 'text-body px-2'
          } ${i === idx ? 'text-white' : 'text-fg-secondary hover:text-fg'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
