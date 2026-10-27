import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { now } from '../lib/clock'
import {
  DAY_START_HOURS,
  formatDayStart,
  parseLocalDate,
  toLocalDateString,
} from '../lib/dates'
import { IconCheck, IconChevronDown } from './icons'

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const optionLabel = (h: number) => (h === 0 ? '12 AM (midnight)' : formatDayStart(h))

/** Settings "Day" card (DESIGN.md §8): the day-start hour. A check-in made
 *  after midnight counts for the previous day until the chosen hour.
 *  The picker is a custom glass listbox popover (not a native <select>:
 *  the OS-rendered popup ignores the theme — white list, unreadable options).
 *  All seven options (12 AM … 6 AM) are always shown, no scrollbar.
 *  Saving is instant on pick with a small "Saved" / error chip. */
export function DayStartCard() {
  const { dayStartHour, setDayStartHour, error } = useSettings()
  const logicalToday = useLogicalToday()
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Auto-dismiss the "Saved" chip.
  useEffect(() => {
    if (saveState !== 'saved') return
    const timer = window.setTimeout(() => setSaveState('idle'), 2200)
    return () => window.clearTimeout(timer)
  }, [saveState])

  // Close the listbox on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function pick(hour: number) {
    setOpen(false)
    setSaveState('idle')
    if (hour === dayStartHour) return
    try {
      await setDayStartHour(hour)
      setSaveState('saved')
    } catch {
      // The context rolled back and exposes the error; show the error chip.
      setSaveState('error')
    }
  }

  const realDate = toLocalDateString(now())
  const dayShifted = logicalToday !== realDate
  const weekdayDate = DATE_FMT.format(parseLocalDate(logicalToday))

  return (
    <section className={`glass-card fade-up rounded-card p-6 ${open ? 'relative z-10' : ''}`}>
      {/* While the listbox is open the card is lifted above its siblings:
          every .glass-card is its own stacking context (backdrop-filter) at
          z-auto, so the Data card below (later in DOM order) would otherwise
          paint OVER the popover that escapes this card's bottom edge. */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-section-title">Day</h2>
        {saveState === 'saved' && (
          <span className="glass-pill rounded-pill px-3 py-1 text-caption font-medium text-accent" role="status">
            Saved
          </span>
        )}
        {saveState === 'error' && error && (
          <span className="rounded-pill bg-danger/10 px-3 py-1 text-caption text-danger" role="alert">
            {error}
          </span>
        )}
      </div>
      <p className="text-caption mt-1 text-fg-muted">
        A check-in after midnight counts for the previous day until this time
      </p>

      <div ref={pickerRef} className="relative mt-4 grid gap-1.5">
        <span id="day-start-label" className="text-caption text-fg-secondary">
          Day starts at
        </span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby="day-start-label day-start-value"
          onClick={() => setOpen((o) => !o)}
          className="input-field flex items-center justify-between text-left"
        >
          <span id="day-start-value">{optionLabel(dayStartHour)}</span>
          <IconChevronDown
            className={`size-4 shrink-0 text-fg-secondary transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <ul
            role="listbox"
            aria-labelledby="day-start-label"
            className="glass-card popover-solid absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-input p-1.5 shadow-xl"
          >
            {DAY_START_HOURS.map((h) => (
              <li key={h} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={h === dayStartHour}
                  onClick={() => void pick(h)}
                  className={`flex h-11 w-full items-center justify-between rounded-input px-3 text-body transition-colors duration-150 ${
                    h === dayStartHour
                      ? 'bg-accent/12 font-medium text-accent'
                      : 'text-fg hover:bg-surface-raised hover:text-fg'
                  }`}
                >
                  <span>{optionLabel(h)}</span>
                  {h === dayStartHour && <IconCheck className="size-4 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-caption mt-3 text-fg-secondary">
        Right now: counted as {weekdayDate}
        {dayShifted && (
          <>
            <br />
            It is after midnight, so this is still {weekdayDate}.
          </>
        )}
      </p>
    </section>
  )
}
