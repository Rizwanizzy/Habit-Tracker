import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { IconCalendar, IconTrash } from './icons'
import { useVacationsContext } from '../contexts/VacationsContext'
import { extractError } from '../hooks/useHabits'
import { validatePeriod, isVacationDay, type VacationPeriod } from '../lib/vacation'

const DAY_FMT = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })

function periodLabel(p: VacationPeriod): string {
  if (p.end_date === null) return `Since ${DAY_FMT.format(new Date(`${p.start_date}T12:00:00`))} · ongoing`
  return `${DAY_FMT.format(new Date(`${p.start_date}T12:00:00`))} – ${DAY_FMT.format(new Date(`${p.end_date}T12:00:00`))}`
}

const fieldClass =
  'pointer-events-none flex h-12 w-full items-center gap-2 rounded-input border border-border bg-surface-raised px-3 text-left text-body transition-colors duration-150 group-hover:bg-surface group-focus-within:ring-2 group-focus-within:ring-accent sm:h-11'

/** Date field for the break schedule: Android browsers refuse to paint the
 *  native `dd/mm/yyyy` placeholder and calendar glyph (user report — the
 *  fields looked like blank pills), so we render our own placeholder/date plus
 *  `IconCalendar`. The real `<input type="date">` is kept but made transparent
 *  and stretched over the whole field, because a direct tap on the input is the
 *  only thing iOS Safari accepts to open its date picker (`showPicker()` from a
 *  button is ignored there; it works on Android/desktop). Tapping therefore
 *  hits the native control everywhere and the OS picker opens itself. */
function DateField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  // ISO `YYYY-MM-DD` → `dd/mm/yyyy` (the placeholder format users asked for).
  const display = value ? value.split('-').reverse().join('/') : 'dd/mm/yyyy'

  return (
    <div className="group relative w-full max-w-[170px] sm:max-w-none sm:flex-1">
      <div aria-hidden="true" className={fieldClass}>
        <IconCalendar className="size-4 shrink-0 text-fg-muted" />
        <span className={value ? 'text-fg' : 'text-fg-muted'}>{display}</span>
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max="9999-12-31"
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-input text-body opacity-0"
      />
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
   *  here too (a scheduled future break must not silently overlap).
   *  startVacation EXPOSES database errors, but anything else it hits
   *  (network failure during auth.getUser / the throw paths) REJECTS — so
   *  the awaits must be wrapped: busy must always be cleared and the
   *  failure shown, otherwise both controls stay dimmed with no reason. */
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
      try {
        await store.startVacation({ start_date: today, end_date: null })
      } catch (e) {
        setSwitchError(extractError(e))
      } finally {
        setBusy(false)
      }
    } else {
      if (!coveringToday) {
        setSwitchError('No break is currently ongoing.')
        return
      }
      setBusy(true)
      try {
        await store.endVacation(coveringToday.id)
      } catch (e) {
        setSwitchError(extractError(e))
      } finally {
        setBusy(false)
      }
    }
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
    try {
      await store.startVacation(candidate)
    } catch (e) {
      setFormErrors([extractError(e)])
    } finally {
      setBusy(false)
    }
    setStartInput('')
    setEndInput('')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    clearMessages()
    setBusy(true)
    try {
      await store.removeVacation(deleteTarget.id)
    } catch (e) {
      setSwitchError(extractError(e))
    } finally {
      setBusy(false)
    }
    setDeleteTarget(null)
  }

  return (
    <div
      className="glass-card fade-up min-w-0 rounded-card p-4 lg:col-span-1 lg:order-none lg:p-6 order-3 col-span-2"
      style={{ animationDelay: '40ms' }}
    >
      <h2 className="text-section-title">Vacation</h2>
      <p className="mt-1 text-body text-fg-secondary max-lg:hidden">
        Pause all habits for a while. Vacation days are neutral — nothing breaks a streak, and
        check-ins you do make still count.
      </p>
      <p className="mt-1 text-[14px] leading-5 text-fg-secondary lg:hidden">
        Pause habits without breaking streaks.
      </p>

      {loading ? (
        <div className="mt-4 grid min-h-16 place-items-center" role="status">
          <span className="text-body text-fg-muted">Loading…</span>
        </div>
      ) : (
        <>
          {/* Pause switch (56px row on phones, existing 44px on desktop). */}
          <button
            type="button"
            role="switch"
            aria-checked={onVacationNow}
            disabled={busy}
            onClick={() => void handlePause(!onVacationNow)}
            className="mt-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-input border border-border bg-surface-raised px-3 py-2 text-left transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60 lg:mt-4 lg:min-h-11"
          >
            <span className="min-w-0">
              <span className="text-body block text-fg">
                {onVacationNow ? 'Habits are paused' : 'Pause all habits'}
              </span>
              <span className="text-caption mt-0.5 block text-fg-muted max-lg:hidden">
                {onVacationNow
                  ? coveringToday
                    ? periodLabel(coveringToday)
                    : 'Ongoing break'
                  : 'Starts an ongoing break from today'}
              </span>
              <span className="text-caption mt-0.5 block text-fg-muted lg:hidden">
                {onVacationNow ? (coveringToday ? periodLabel(coveringToday) : 'Ongoing break') : 'Starts today'}
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

          {/* Schedule a break — desktop keeps the custom date fields (icon +
              dd/mm/yyyy placeholder with the native input stretched on top
              for iOS); phones put two plain native date inputs side by side
              at 16px font (iOS zooms on focus otherwise), no overlay. */}
          <form onSubmit={(e) => void handleSchedule(e)} className="mt-5 max-lg:hidden">
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

          {/* Phone (below lg) schedule form: same state, validation, errors,
              button. Native date inputs in 50/50 columns — the visual box is
              Tailwind; the iOS-critical bits (appearance, height, padding,
              16px font, line-height + the ::-webkit pseudo fixes) live in
              the `.date-field` CSS class (see index.css for the root cause
              of the iPhone overflow this fixes). While empty, an overlay
              "dd-mm-yyyy" span stands in for the value (iOS paints nothing
              when empty, Chromium's own text is hidden via data-empty). */}
          <form onSubmit={(e) => void handleSchedule(e)} className="mt-5 lg:hidden">
            <p className="text-caption font-medium uppercase tracking-wide text-fg-muted">Schedule a break</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="break-start" className="text-caption text-fg-secondary">
                  From
                </label>
                <div className="relative min-w-0">
                  <input
                    id="break-start"
                    type="date"
                    value={startInput}
                    onChange={(e) => {
                      setStartInput(e.target.value)
                      clearMessages()
                    }}
                    max="9999-12-31"
                    data-empty={startInput === '' ? 'true' : undefined}
                    className="date-field block w-full min-w-0 max-w-full box-border rounded-input border border-border bg-surface-raised text-fg transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  />
                  {startInput === '' && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center truncate text-[14px] text-fg-secondary lg:hidden"
                    >
                      dd-mm-yyyy
                    </span>
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="break-end" className="text-caption text-fg-secondary">
                  To
                </label>
                <div className="relative min-w-0">
                  <input
                    id="break-end"
                    type="date"
                    value={endInput}
                    onChange={(e) => {
                      setEndInput(e.target.value)
                      clearMessages()
                    }}
                    max="9999-12-31"
                    data-empty={endInput === '' ? 'true' : undefined}
                    className="date-field block w-full min-w-0 max-w-full box-border rounded-input border border-border bg-surface-raised text-fg transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  />
                  {endInput === '' && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center truncate text-[14px] text-fg-secondary lg:hidden"
                    >
                      dd-mm-yyyy
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-caption mt-1 text-fg-muted">Leave “To” empty for an ongoing break.</p>
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
