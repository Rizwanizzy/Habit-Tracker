interface Props {
  /** Selected tiles per row (1–6), owned by the Today page (persisted). */
  value: number
  onChange: (next: number) => void
  className?: string
}

const MIN = 1

/** "Per row" stepper (DESIGN.md §8): a glass pill with −/value/+ that lets
 *  the user choose how many habit tiles share a row on the Today grid.
 *  Numbers below become full-width; above, tiles compact automatically via
 *  the container-query rules. The −/+ buttons are 32-36px with invisible hit
 *  pads (positioned elements!) keeping the ≥44px target rule. */
export function TileDensity({ value, onChange, className = '' }: Props) {
  return (
    <div
      role="group"
      aria-label="Habit tiles per row"
      className={`glass-pill inline-flex items-center gap-0.5 sm:gap-1 rounded-pill p-1 ${className}`}
    >
      <span className="text-[10px] sm:text-caption select-none pl-1 sm:pl-2.5 pr-0.5 text-fg-muted whitespace-nowrap truncate">
        Per row
      </span>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= MIN}
        aria-label="Fewer tiles per row"
        className="relative grid size-7.5 sm:size-9 place-items-center rounded-pill text-caption sm:text-body text-fg-secondary transition-colors duration-150 after:absolute after:inset-[-8px] after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none hover:text-fg disabled:opacity-40"
      >
        −
      </button>
      <span aria-live="polite" className="text-caption w-3.5 sm:w-5 select-none text-center tabular-nums font-medium text-fg">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 6}
        aria-label="More tiles per row"
        className="relative grid size-7.5 sm:size-9 place-items-center rounded-pill text-caption sm:text-body text-fg-secondary transition-colors duration-150 after:absolute after:inset-[-8px] after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none hover:text-fg disabled:opacity-40"
      >
        +
      </button>
      {/* Trailing pad keeps the pill's right rounding after the + button. */}
      <span className="w-0.5" aria-hidden="true" />
    </div>
  )
}
