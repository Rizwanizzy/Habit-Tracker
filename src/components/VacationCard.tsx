import { useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { IconCalendar, IconTrash } from './icons'
import { useVacationsContext } from '../contexts/VacationsContext'
import { validatePeriod, isVacationDay, type VacationPeriod } from '../lib/vacation'

const DAY_FMT = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })

function periodLabel(p: VacationPeriod): string {
  if (p.end_date === null) return `Since ${DAY_FMT.format(new Date(`${p.start_date}T12:00:00`))} · ongoing`
  return `${DAY_FMT.format(new Date(`${p.start_date}T12:00:00`))} – ${DAY_FMT.format(new Date(`${p.end_date}T12:00:00`))}`
}

const fieldButtonClass =
  'flex h-12 w-full items-center gap-2 rounded-input border border-border bg-surface-raised px-3 text-left text-body transition-colors duration-150 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-11'

/** Date field for the break schedule: the native `<input type="date">` stays
 *  in the DOM (it owns the OS picker) but is visually hidden, because Android
 *  browsers refuse to paint its `dd/mm/yyyy` placeholder and calendar glyph
 *  (user report — Chrome/Android rendered the fields as blank pills). Our own
 *  button shows the placeholder or the chosen date and opens the native
 *  picker through `showPicker()`. */
function DateField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  // ISO `YYYY-MM-DD` → `dd/mm/yyyy` (the placeholder format users asked for).
  const display = value ? value.split('-').reverse().join('/') : 'dd/mm/yyyy'

  function openPicker() {
    const el = ref.current
    if (!el) return
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker()
      } else {
        // Older Safari/WebViews: focusing + clicking opens the wheel picker.
        el.focus()
        el.click()
      }
    } catch {
      // Picker already open or blocked by the browser — focusing the input
      // keeps the native UI reachable with a second tap.
      el.focus()
    }
  }

  return (
    <div className="relative w-full max-w-[170px] sm:max-w-none sm:flex-1">
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max="9999-12-31"
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      />
      <button type="button" onClick={openPicker} aria-label={label} className={fieldButtonClass}>
        <IconCalendar className="size-4 shrink-0 text-fg-muted" />
        <span className={value ? 'text-fg' : 'text-fg-muted'}>{display}</span>
      </button>
    </div>
  )
}

/** Settings "Vacation" card (DESIGN.md §8): a global pause for every habit.
 *  The pause switch starts an ongoing period from the logical today (off =
 *  end it yesterday); a schedule form adds finite/past breaks for backfill;
 *  each period is listed with a delete behind a ConfirmDialog. Vacation days
 *  are NEUTRAL for all habits (same rules as skipped; done still wins). */
export function VacationCard() {
  const store = useVacationsContext()
  const { periods, today, loading, error } = store

  const [busy, setBusy] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [formErrors, setFormErrors] = useState<string[] | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VacationPeriod | null>(null)

  // Validation/action errors are persistent Inline text (exposed, never
  // thrown); they clear on the next successful action or input change.

  const onVacationNow = isVacationDay(today, periods)
  const ongoingPeriod = periods.find((p) => p.end_date === null) ?? null
  const coveringToday = periods.find(
    (p) => today >= p.start_date && (p.end_date === null || today <= p.end_date),
  )

  function clearMessages() {
    setFormErrors(null)
    setSwitchError(null)
  }

  /** Pause now: an ongoing period from the logical today. Validation runs
   *  here too (a scheduled future break must not silently overlap). */
  async function handlePause(on: boolean) {
    if (busy) return
    clearMessages()
    if (on) {
      const errors = validatePeriod(periods, { start_date: today, end_date: null })
      if (errors.length > 0) {
        setSwitchError(errors.join(' '))
        return
      }
      setBusy(true)
      await store.startVacation({ start_date: today, end_date: null })
    } else {
      if (!coveringToday) {
        setSwitchError('No break is currently ongoing.')
        return
      }
      setBusy(true)
      await store.endVacation(coveringToday.id)
    }
    setBusy(false)
  }

  /** Add a scheduled break (past dates allowed, for backfill). An empty end
   *  date means ongoing. Inline errors come from validatePeriod. */
  async function handleSchedule(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy || !startInput) return
    clearMessages()
    const end = endInput === '' ? null : endInput
    const candidate = { start_date: startInput, end_date: end }
    const errors = validatePeriod(periods, candidate)
    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }
    setBusy(true)
    await store.startVacation(candidate)
    setBusy(false)
    setStartInput('')
    setEndInput('')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    clearMessages()
    setBusy(true)
    await store.removeVacation(deleteTarget.id)
    setBusy(false)
    setDeleteTarget(null)
  }

  return (
    <div className="glass-card fade-up rounded-card p-6" style={{ animationDelay: '40ms' }}>
      <h2 className="text-section-title">Vacation</h2>
      <p className="mt-1 text-body text-fg-secondary">
        Pause all habits for a while. Vacation days are neutral — nothing breaks a streak, and
        check-ins you do make still count.
      </p>

      {loading ? (
        <div className="mt-4 grid min-h-16 place-items-center" role="status">
          <span className="text-body text-fg-muted">Loading…</span>
        </div>
      ) : (
        <>
          {/* Pause switch */}
          <button
            type="button"
            role="switch"
            aria-checked={onVacationNow}
            disabled={busy}
            onClick={() => void handlePause(!onVacationNow)}
            className="mt-4 flex min-h-11 w-full items-center justify-between gap-3 rounded-input border border-border bg-surface-raised px-3 py-2 text-left transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="text-body block text-fg">
                {onVacationNow ? 'Habits are paused' : 'Pause all habits'}
              </span>
              <span className="text-caption mt-0.5 block text-fg-muted">
                {onVacationNow ? (coveringToday ? periodLabel(coveringToday) : 'Ongoing break') : 'Starts an ongoing break from today'}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors duration-200 ${
                onVacationNow ? 'bg-accent' : 'bg-fg/20'
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200 ${
                  onVacationNow ? 'left-[1.4rem]' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          {switchError && (
            <p role="alert" className="text-caption mt-2 rounded-input bg-danger/10 px-3 py-2 text-danger">
              {switchError}
            </p>
          )}

          {/* Schedule a break */}
          <form onSubmit={(e) => void handleSchedule(e)} className="mt-5">
            <p className="text-caption font-medium uppercase tracking-wide text-fg-muted">Schedule a break</p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:gap-4">
              <div className="flex flex-col gap-1.5 sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-caption text-fg-secondary">From</span>
                <DateField
                  value={startInput}
                  onChange={(value) => {
                    setStartInput(value)
                    clearMessages()
                  }}
                  label="Break start date"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-caption text-fg-secondary">To</span>
                <DateField
                  value={endInput}
                  onChange={(value) => {
                    setEndInput(value)
                    clearMessages()
                  }}
                  label="Break end date (empty for ongoing)"
                />
              </div>
            </div>
            <p className="text-caption mt-1 text-fg-muted">Leave “To” empty for an ongoing break. Past dates are allowed for backfill.</p>
            {formErrors && formErrors.length > 0 && (
              <ul role="alert" className="text-caption mt-2 rounded-input bg-danger/10 px-3 py-2 text-danger">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
            <button
              type="submit"
              disabled={busy || !startInput}
              className="mt-3 inline-flex h-11 items-center rounded-pill bg-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              Add break
            </button>
          </form>

          {/* Period list */}
          {periods.length > 0 && (
            <div className="mt-5">
              <p className="text-caption font-medium uppercase tracking-wide text-fg-muted">Breaks</p>
              <ul className="mt-2 flex flex-col gap-2">
                {periods.map((p) => (
                  <li
                    key={p.id}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-input border border-border bg-surface-raised px-3 py-2"
                  >
                    <span className="text-body min-w-0 truncate text-fg" title={p.end_date ? `${p.start_date} – ${p.end_date}` : `${p.start_date} – ongoing`}>
                      {periodLabel(p)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      aria-label={`Delete break ${periodLabel(p)}`}
                      disabled={busy}
                      className="grid size-11 shrink-0 place-items-center rounded-pill text-fg-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger disabled:opacity-60"
                    >
                      <IconTrash className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="text-caption mt-4 rounded-input bg-danger/10 px-3 py-2 text-danger">
              {error}
            </p>
          )}

          {/* Ongoing note keeps the switch honest when a past one-shot ended. */}
          {ongoingPeriod && !onVacationNow && (
            <p className="text-caption mt-3 text-fg-muted">
              An ongoing break starts on a future date; deleting it is in the list above.
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete break?"
        description={
          deleteTarget
            ? `${periodLabel(deleteTarget)} — its days will stop being neutral (past stats already saved are unchanged).`
            : ''
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
        danger
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
