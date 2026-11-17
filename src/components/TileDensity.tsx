interface Props {
  /** Selected value, owned by the Today page (persisted): tiles per row for
   *  the Tiles grid, or the Matrix habit-name pane width level (1–4). */
  value: number
  onChange: (next: number) => void
  className?: string
  /** Pill caption and stepper range/labels. The DEFAULTS are the Tiles
   *  "Per row" stepper (1–6) — bit-for-bit the previous behavior; the
   *  Matrix reuses this same pill in its existing position as a "Habit
   *  names" width stepper (1–4) with its own labels. */
  label?: string
  max?: number
  groupLabel?: string
  minusLabel?: string
  plusLabel?: string
}

const MIN = 1
const DEFAULT_MAX = 6

/** Stepper pill (DESIGN.md §8): a glass pill with −/value/+ in one shared
 *  position above the habit grid. Tiles mode: how many habit tiles share a
 *  row. Matrix mode (same pill, same size/styling): how wide the fixed
 *  habit-name pane is — each step adds one date-column width. The −/+
 *  buttons are 32-36px with invisible hit pads (positioned elements!)
 *  keeping the ≥44px target rule. */
export function TileDensity({
  value,
  onChange,
  className = '',
  label = 'Per row',
  max = DEFAULT_MAX,
  groupLabel = 'Habit tiles per row',
  minusLabel = 'Fewer tiles per row',
  plusLabel = 'More tiles per row',
}: Props) {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={`glass-pill inline-flex items-center gap-0.5 sm:gap-1 rounded-pill p-1 ${className}`}
    >
      <span className="text-[10px] sm:text-caption select-none pl-1 sm:pl-2.5 pr-0.5 text-fg-muted whitespace-nowrap truncate">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= MIN}
        aria-label={minusLabel}
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
        disabled={value >= max}
        aria-label={plusLabel}
        className="relative grid size-7.5 sm:size-9 place-items-center rounded-pill text-caption sm:text-body text-fg-secondary transition-colors duration-150 after:absolute after:inset-[-8px] after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none hover:text-fg disabled:opacity-40"
      >
        +
      </button>
      {/* Trailing pad keeps the pill's right rounding after the + button. */}
      <span className="w-0.5" aria-hidden="true" />
    </div>
  )
}
