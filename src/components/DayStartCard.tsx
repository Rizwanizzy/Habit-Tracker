import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
/** Phone live line: "Counts as Wednesday November 4" — the full date, wrapped
 *  to at most two lines (line-clamp-2) so the card's vacant space is used
 *  without growing either card (Day and Data stay equal by grid stretch). */

const optionLabel = (h: number) => (h === 0 ? '12 AM (midnight)' : formatDayStart(h))

const PHONE_QUERY = '(max-width: 1023.98px)'

function subscribePhone(callback: () => void): () => void {
  const mql = window.matchMedia(PHONE_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

/** Reactive below-lg check gating the phone-only tweaks (short option
 *  labels, 44px/14px trigger via `.input-field-phone`, 11px caption, the
 *  compact live line and the popover collision handling). The popover
 *  itself is the SAME anchored listbox on phones and desktop. */
function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  )
}

/** Settings "Day" card (DESIGN.md §8): the day-start hour. A check-in made
 *  after midnight counts for the previous day until the chosen hour.
 *  The picker is a custom glass listbox popover (not a native <select>:
 *  the OS-rendered popup ignores the theme — white list, unreadable options).
 *  All seven options (12 AM … 6 AM) are always shown, no scrollbar.
 *  Saving is instant on pick with a small "Saved" / error chip.
 *  Phones (below lg) share the same anchored popover — no bottom sheet —
 *  with three tweaks: short option labels ("12 AM", not "12 AM (midnight)"),
 *  a 44px/14px trigger, and collision handling that flips the popover above
 *  the trigger (or caps it with an internal scroll) so it never hides
 *  behind the bottom dock. Desktop behaviour is unchanged. */
export function DayStartCard() {
  const { dayStartHour, setDayStartHour, error } = useSettings()
  const logicalToday = useLogicalToday()
  const isPhone = useIsPhone()
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  /** Phone collision result: open downward (default), upward, or capped. */
  const [drop, setDrop] = useState<{ dir: 'down' | 'up'; cap: number | null }>({
    dir: 'down',
    cap: null,
  })
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Auto-dismiss the "Saved" chip.
  useEffect(() => {
    if (saveState !== 'saved') return
    const timer = window.setTimeout(() => setSaveState('idle'), 2200)
    return () => window.clearTimeout(timer)
  }, [saveState])

  // Close the listbox on outside click / Escape (both presentations).
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

  // Phone-only collision handling: keep the popover inside the viewport and
  // clear of the bottom dock — flip it above the trigger when there is no
  // room below, or cap its height with an internal scroll when neither side
  // fits. Desktop never runs this (it always has room and must stay exactly
  // as before). The popover height is estimated (7 × 44px rows + padding) so
  // the direction is decided before the first paint — no flicker.
  useEffect(() => {
    if (!open || !isPhone) return
    const trigger = triggerRef.current
    if (!trigger) return
    const estimated = DAY_START_HOURS.length * 44 + 12 // rows + p-1.5
    const dockClearance = 96 // dock (72px) + margin
    const rect = trigger.getBoundingClientRect()
    const below = window.innerHeight - dockClearance - rect.bottom
    if (below >= estimated) setDrop({ dir: 'down', cap: null })
    else if (rect.top - 8 >= estimated) setDrop({ dir: 'up', cap: null })
    else setDrop({ dir: 'down', cap: Math.max(132, below) })
  }, [open, isPhone])

  function toggle() {
    setDrop({ dir: 'down', cap: null })
    setOpen((o) => !o)
  }

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
  const logicalDate = parseLocalDate(logicalToday)
  const weekdayDate = DATE_FMT.format(logicalDate)
  /** Phone options use the short label ("12 AM"); desktop keeps "(midnight)". */
  const label = (h: number) => (isPhone ? formatDayStart(h) : optionLabel(h))

  return (
    <section
      className={`glass-card fade-up order-1 min-w-0 rounded-card p-3.5 lg:order-none lg:p-6 ${open ? 'relative z-10' : ''}`}
    >
      {/* While the listbox is open the card is lifted above its siblings:
          every .glass-card is its own stacking context (backdrop-filter) at
          z-auto, so sibling cards (Data beside it on phones, Data below and
          Habits at right on desktop) would otherwise paint OVER the popover
          that escapes this card's box. The popover itself is z-40, above the
          dock's z-30, so it can never hide behind the dock on phones. */}
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
      <p className="text-caption mt-1 text-fg-muted max-lg:hidden">
        A check-in after midnight counts for the previous day until this time
      </p>

      <div ref={pickerRef} className="relative mt-3 grid gap-1.5 lg:mt-4">
        <span
          id="day-start-label"
          className={isPhone ? 'text-[11px] text-fg-secondary' : 'text-caption text-fg-secondary'}
        >
          Day starts at
        </span>
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby="day-start-label day-start-value"
            onClick={toggle}
            className="input-field input-field-phone flex items-center justify-between gap-2 text-left"
          >
            <span id="day-start-value" className="min-w-0 truncate">
              {label(dayStartHour)}
            </span>
            <IconChevronDown
              className={`size-4 shrink-0 text-fg-secondary transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </button>
          {open && (
            <ul
              role="listbox"
              aria-labelledby="day-start-label"
              className={`glass-card popover-solid absolute left-0 right-0 z-40 min-w-[120px] rounded-input p-1.5 shadow-xl ${
                drop.dir === 'up' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
              } ${drop.cap !== null ? 'overflow-y-auto overscroll-contain' : ''}`}
              style={drop.cap !== null ? { maxHeight: drop.cap } : undefined}
            >
              {DAY_START_HOURS.map((h) => (
                <OptionRow
                  key={h}
                  selected={h === dayStartHour}
                  label={label(h)}
                  onPick={() => void pick(h)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Live "counts as" line — desktop wording kept; phones get the full
          date ("Counts as Wednesday November 4") wrapped to AT MOST two
          lines (line-clamp-2, no truncation/nowrap). The Day card is
          inherently shorter than the Data card (which carries the two
          pills), so this fills some of the vacant space the grid stretch
          already allocates — it never exceeds two lines and never grows
          either card (the two stay equal by grid stretch). */}
      <p className="text-caption mt-3 text-fg-secondary max-lg:hidden">
        Right now: counted as {weekdayDate}
        {dayShifted && (
          <>
            <br />
            It is after midnight, so this is still {weekdayDate}.
          </>
        )}
      </p>
      <p className="mt-2 line-clamp-2 min-w-0 text-[12px] leading-4 text-fg-secondary lg:hidden">
        Counts as {weekdayDate}
      </p>
    </section>
  )
}

interface OptionRowProps {
  selected: boolean
  /** "12 AM (midnight)" on desktop, "12 AM" on phones. */
  label: string
  onPick: () => void
}

/** One 44px hour option of the day-start listbox (shared by both). */
function OptionRow({ selected, label, onPick }: OptionRowProps) {
  return (
    <li role="none">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onPick}
        className={`flex h-11 w-full items-center justify-between rounded-input px-3 text-body transition-colors duration-150 ${
          selected ? 'bg-accent/12 font-medium text-accent' : 'text-fg hover:bg-surface-raised hover:text-fg'
        }`}
      >
        <span>{label}</span>
        {selected && <IconCheck className="size-4 shrink-0" />}
      </button>
    </li>
  )
}
