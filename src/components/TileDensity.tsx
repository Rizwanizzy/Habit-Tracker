interface Props {
  /** Selected tiles per row (1–6), owned by the Today page (persisted). */
  value: number
  onChange: (next: number) => void
}

const MIN = 1

/** "Per row" stepper (DESIGN.md §8): a glass pill with −/value/+ that lets
 *  the user choose how many habit tiles share a row on the Today grid.
 *  Numbers below become full-width; above, tiles compact automatically via
 *  the container-query rules. The −/+ buttons are 36px with invisible hit
 *  pads (positioned elements!) keeping the ≥44px target rule. */
export function TileDensity({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Habit tiles per row"
      className="glass-pill inline-flex shrink-0 items-center gap-1 rounded-pill p-1"
    >
      <span className="text-caption select-none pl-2.5 pr-0.5 text-fg-muted">Per row</span>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= MIN}
        aria-label="Fewer tiles per row"
        className="relative grid size-9 place-items-center rounded-pill text-body text-fg-secondary transition-colors duration-150 after:absolute after:inset-y-[-4px] after:inset-x-1 after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none hover:text-fg disabled:opacity-40"
      >
        −
      </button>
      <span aria-live="polite" className="text-caption w-5 select-none text-center tabular-nums text-fg">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 6}
        aria-label="More tiles per row"
        className="relative grid size-9 place-items-center rounded-pill text-body text-fg-secondary transition-colors duration-150 after:absolute after:inset-y-[-4px] after:inset-x-1 after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none hover:text-fg disabled:opacity-40"
      >
        +
      </button>
      {/* Trailing pad keeps the pill's right rounding after the + button. */}
      <span className="w-0.5" aria-hidden="true" />
    </div>
  )
}
