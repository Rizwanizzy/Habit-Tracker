import {
  FRIDAY,
  MONDAY,
  SATURDAY,
  SUNDAY,
  THURSDAY,
  TUESDAY,
  WEDNESDAY,
} from '../lib/schedule'

const DAYS: ReadonlyArray<readonly [short: string, name: string, bit: number]> = [
  ['Mon', 'Monday', MONDAY],
  ['Tue', 'Tuesday', TUESDAY],
  ['Wed', 'Wednesday', WEDNESDAY],
  ['Thu', 'Thursday', THURSDAY],
  ['Fri', 'Friday', FRIDAY],
  ['Sat', 'Saturday', SATURDAY],
  ['Sun', 'Sunday', SUNDAY],
]

interface Props {
  /** Selected weekday mask (7-bit, Monday = 1 … Sunday = 64). */
  value: number
  onChange: (mask: number) => void
  disabled?: boolean
}

/** Seven toggle chips for the weekdays repeat mode, shared by the desktop
 *  form and the phone form. One equal-width column per day so the row fits
 *  a 360px screen; short labels + full aria-labels keep it accessible. */
export function WeekdayPicker({ value, onChange, disabled = false }: Props) {
  return (
    <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-1">
      {DAYS.map(([short, name, bit]) => {
        const selected = (value & bit) !== 0
        return (
          <button
            key={bit}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={name}
            onClick={() => onChange(value ^ bit)}
            className={`h-11 rounded-pill text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 ${
              selected
                ? 'bg-accent text-white'
                : 'bg-surface-raised text-fg-secondary hover:text-fg'
            }`}
          >
            {short}
          </button>
        )
      })}
    </div>
  )
}
