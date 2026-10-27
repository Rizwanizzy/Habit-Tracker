import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { extractError } from '../hooks/useHabits'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useEntries } from '../hooks/useEntries'
import { currentStreak, isDone, type Entry, type Habit } from '../lib/score'
import { dayStatus, isNeutral } from '../lib/dayStatus'
import { addDays, formatDayStart, parseLocalDate, toLocalDateString } from '../lib/dates'
import { isVacationDay, vacationDatesInRange } from '../lib/vacation'
import { useVacationsContext } from '../contexts/VacationsContext'
import { now } from '../lib/clock'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { useSettings } from '../contexts/SettingsContext'
import { layoutRings } from '../lib/rings'
import { ThemeIconButton } from '../components/ThemeIconButton'
import { ProgressRings } from '../components/ProgressRings'
import { CompletionCard } from '../components/CompletionCard'
import { TileDensity } from '../components/TileDensity'
import { HabitReorderGrid } from '../components/HabitReorderGrid'
import { IconChevronLeft, IconChevronRight, IconFlame } from '../components/icons'
import { TodayGreeting } from '../components/TodayGreeting'

function upsertEntry(list: Entry[], entry: Entry): Entry[] {
  const i = list.findIndex((e) => e.date === entry.date)
  if (i === -1) return [...list, entry]
  const copy = list.slice()
  copy[i] = entry
  return copy
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function Today() {
  const shared = useHabitsContext()
  const { loading: habitsLoading, error: habitsError, reload } = shared
  const { reorderHabits, reorderError } = shared
  // Shared list holds every habit; views filter archived (never re-sort —
  // the context list is already in habit order).
  const habits = useMemo(() => shared.habits.filter((h) => !h.archived), [shared.habits])
  const ids = habits.map((h) => h.id)
  const {
    entriesByHabit,
    loading: entriesLoading,
    error: entriesError,
    saveEntry,
    skipEntry,
    removeEntry,
    setEntriesByHabit,
  } = useEntries(ids)

  const today = useLogicalToday()
  const { dayStartHour } = useSettings()
  // Vacation mode: one shared period list; the hero, tiles and stats all ask
  // dayStatus (which takes the concrete vacation DATES in this window).
  const vacationsStore = useVacationsContext()
  const vacationPeriods = vacationsStore.periods
  const vacationToday = useMemo(() => isVacationDay(today, vacationPeriods), [today, vacationPeriods])
  /** Every vacation date the stats window needs (streaks walk back from today). */
  const vacationDays = useMemo(
    () => vacationDatesInRange(vacationPeriods, addDays(today, -400), today),
    [vacationPeriods, today],
  )
  // The pause switch ends the period covering today (ongoing preferred).
  const activeVacation = useMemo(
    () => vacationPeriods.find((p) => today >= p.start_date && (p.end_date === null || today <= p.end_date)) ?? null,
    [vacationPeriods, today],
  )
  // The logical day can differ from the real calendar date after midnight
  // (day-start setting) — the pill then carries a "counting as" caption.
  const dayShifted = today !== toLocalDateString(now())
  const [selectedDate, setSelectedDate] = useState(today)
  const [actionError, setActionError] = useState<string | null>(null)

  // Tiles-per-row density (1–6): the user's grid-width preference — no code
  // changes needed to rearrange rows. Persisted, validated on read.
  const [perRow, setPerRow] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('tile-columns')
      return stored && /^[1-6]$/.test(stored) ? Number(stored) : 5
    } catch {
      return 5
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('tile-columns', String(perRow))
    } catch {
      // Storage disabled: the choice just doesn't persist.
    }
  }, [perRow])

  // --- Reorder (jiggle) mode -------------------------------------------------
  // Long-press (350ms, 8px tolerance on both pointer and touch) lifts the tile
  // and enters the mode; Escape or the Done pill exits it. Drag/drop saves the
  // new order through reorderHabits (optimistic, rolls back on failure).
  const [reorderMode, setReorderMode] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null)

  // Escape exits reorder mode.
  useEffect(() => {
    if (!reorderMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReorderMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reorderMode])

  // Auto-dismiss toasts ("Order saved" / failure messages).
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Vacation action failures surface in the same toast (notes are exposed —
  // the hook never throws).
  useEffect(() => {
    if (vacationsStore.error) setNotice({ kind: 'danger', text: vacationsStore.error })
  }, [vacationsStore.error])

  // reorderHabits fails soft (it rolls back and exposes reorderError), so
  // surface a failure toast when that state flips.
  useEffect(() => {
    if (reorderError) setNotice({ kind: 'danger', text: reorderError })
  }, [reorderError])

  const isPast = selectedDate !== today

  /** Optimistic apply + per-habit remote queue. The UI updates instantly
   *  (before syncing), so rapid check→uncheck taps never sit inside a
   *  "busy" window that would silently drop clicks (the old global `busy`
   *  guard made unchecking need 2–3 taps while a sync was in flight). Each
   *  habit's remote ops chain in click order, so the LAST tap's state is the
   *  final one; a failure only rolls back and errors that habit's pending
   *  ops — blockers for other habits don't exist anymore. */
  const remoteQueues = useRef(new Map<string, Promise<void>>())

  function applyLocal(
    habit: Habit,
    mutate: (prev: Entry[]) => Entry[],
    remote: () => Promise<unknown>,
  ) {
    setActionError(null)
    const prev = entriesByHabit[habit.id] ?? []
    setEntriesByHabit((map) => ({ ...map, [habit.id]: mutate(prev) }))
    const previous = remoteQueues.current.get(habit.id) ?? Promise.resolve()
    const queued = previous.then(async () => {
      try {
        await remote()
      } catch (e) {
        // Roll back this habit and surface the error; later queued ops (from
        // even newer taps) run on top of the rolled-back state.
        setEntriesByHabit((map) => ({ ...map, [habit.id]: prev }))
        setActionError(extractError(e))
      }
    })
    // Store a never-rejecting tail so one failure doesn't poison the chain.
    remoteQueues.current.set(habit.id, queued.catch(() => undefined))
  }

  function toggle(habit: Habit) {
    const existing = (entriesByHabit[habit.id] ?? []).find((e) => e.date === selectedDate)
    const markingDone = !(existing && isDone(habit, existing))
    const value = habit.type === 'numeric' ? habit.target : 1
    void applyLocal(
      habit,
      (prev) =>
        markingDone
          ? upsertEntry(prev, { date: selectedDate, value, status: 'done' })
          : prev.filter((e) => e.date !== selectedDate),
      () => (markingDone ? saveEntry(habit.id, selectedDate, value) : removeEntry(habit.id, selectedDate)),
    )
  }

  function logValue(habit: Habit, value: number) {
    void applyLocal(
      habit,
      (prev) => upsertEntry(prev, { date: selectedDate, value, status: 'done' }),
      () => saveEntry(habit.id, selectedDate, value),
    )
  }

  /** Skip this habit on the selected day (neutral — no streak break, no
   *  score drop): upserts a status-'skipped' row; undo deletes the row.
   *  Checking in on a skipped day stays possible through toggle (upserts
   *  status 'done'). Only a day without a done entry can be skipped. */
  function skip(habit: Habit) {
    const existing = (entriesByHabit[habit.id] ?? []).find((e) => e.date === selectedDate)
    if (existing && isDone(habit, existing)) return
    const skipping = !(existing && existing.status === 'skipped')
    void applyLocal(
      habit,
      (prev) =>
        skipping
          ? upsertEntry(prev, { date: selectedDate, value: 0, status: 'skipped' })
          : prev.filter((e) => e.date !== selectedDate),
      () => (skipping ? skipEntry(habit.id, selectedDate) : removeEntry(habit.id, selectedDate)),
    )
  }

  function resumeVacation() {
    if (!activeVacation) return
    setActionError(null)
    void vacationsStore.endVacation(activeVacation.id)
  }

  /** Longest active streak across habits — the hero card's "overall streak". */
  const overallStreak = useMemo(
    () =>
      habits.reduce((best, h) => {
        const s = currentStreak(h, entriesByHabit[h.id] ?? [], today, vacationDays)
        return s > best ? s : best
      }, 0),
    [habits, entriesByHabit, today, vacationDays],
  )

  // Hero counts go through dayStatus (the rule: every "is this day counted"
  // question). A skipped habit is excluded from the total — never a 0% miss.
  const dayStatuses = useMemo(
    () =>
      habits.map((h) =>
        dayStatus({
          habit: h,
          date: selectedDate,
          entry: (entriesByHabit[h.id] ?? []).find((e) => e.date === selectedDate),
          today: selectedDate,
          vacations: vacationDays,
        }),
      ),
    [habits, entriesByHabit, selectedDate, vacationDays],
  )

  const doneToday = dayStatuses.filter((s) => s === 'done').length
  const skippedToday = dayStatuses.filter(isNeutral).length
  const totalToday = habits.length - skippedToday

  const motivational =
    habits.length === 0
      ? ''
      : totalToday === 0
        ? 'All caught up.'
        : doneToday === totalToday
          ? 'All habits done — beautiful.'
          : doneToday === 0
            ? 'Start with one small win.'
            : `Almost there — ${totalToday - doneToday} to go.`

  // Rings layout: only needed here for the hidden-habits note (rings cap at
  // 28 shown habits); the rings component runs its own layoutRings.
  const ringLayout = useMemo(() => layoutRings(habits.map((h) => h.id)), [habits])

  const dateLabel = DATE_FMT.format(parseLocalDate(selectedDate))
  const todayLabel = DATE_FMT.format(parseLocalDate(today))

  const pageError = habitsError ?? entriesError
  if (pageError) {
    return (
      <section>
        <TodayGreeting />
        <div className="glass-card mt-6 rounded-card p-6 text-center" role="alert">
          <p className="text-body text-danger">{pageError}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 h-11 rounded-pill border border-danger px-4 text-body font-medium text-danger transition-colors duration-150 hover:bg-danger/10"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (habitsLoading || entriesLoading) {
    return (
      <section>
        <TodayGreeting />
        <div className="glass-card mt-6 grid min-h-32 place-items-center rounded-card p-10" role="status">
          <span className="text-body text-fg-muted">Loading…</span>
        </div>
      </section>
    )
  }

  if (habits.length === 0) {
    return (
      <section>
        <TodayGreeting />
        <p className="text-caption mt-1 text-fg-muted">{dateLabel}</p>
        <div className="glass-card mt-6 rounded-card p-6 text-center">
          <p className="text-body text-fg-secondary">No habits yet.</p>
          <p className="mt-1 text-caption text-fg-muted">Create your first habit to start tracking.</p>
          <Link
            to="/habits/new"
            className="mt-4 inline-flex h-12 items-center rounded-pill bg-accent-gradient px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110"
          >
            Add habit
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      {/* Header: greeting block on the left, date pill + primary action on the right */}
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <TodayGreeting />
        {/* Day-start notice sits between the greeting and the header controls,
            centered in the leftover space (user request — was under the pill). */}
        {dayShifted && (
          <p className="text-caption text-center text-fg-muted lg:flex-1">
            Counting as {todayLabel} until {formatDayStart(dayStartHour)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ThemeIconButton disabled={reorderMode} />
          <div
            role="group"
            aria-label="Date navigation"
            className="glass-pill flex items-center gap-1 rounded-pill p-1"
          >
            <button
              type="button"
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              aria-label="Previous day"
              className="grid size-11 place-items-center rounded-pill text-fg-secondary transition-colors duration-150 hover:text-fg"
            >
              <IconChevronLeft className="size-5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              aria-label="Pick a date to log"
              className="h-11 w-36 min-w-0 rounded-pill bg-transparent px-2 text-center text-body text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              disabled={isPast === false}
              aria-label="Next day"
              className="grid size-11 place-items-center rounded-pill text-fg-secondary transition-colors duration-150 hover:text-fg disabled:opacity-40"
            >
              <IconChevronRight className="size-5" />
            </button>
            {isPast && (
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className="text-caption h-11 rounded-pill bg-accent px-3 text-white"
              >
                Today
              </button>
            )}
          </div>
          {reorderMode ? (
            <div className="flex items-center gap-3">
              <span className="text-caption text-fg-muted">Drag to reorder</span>
              <button
                type="button"
                onClick={() => setReorderMode(false)}
                className="inline-flex h-12 shrink-0 items-center rounded-pill bg-accent-gradient glow-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 hover:translate-y-[-1px]"
              >
                Done
              </button>
            </div>
          ) : (
            <Link
              to="/habits/new"
              className="inline-flex h-12 shrink-0 items-center rounded-pill bg-accent-gradient glow-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 hover:translate-y-[-1px]"
            >
              Add habit
            </Link>
          )}
        </div>
      </header>

      <div className="mb-3 mt-1 flex flex-wrap items-end justify-between gap-3 lg:mt-0">
        {habits.length > 7 && (
          <p className="text-caption max-w-[70%] text-fg-muted">
            You have {habits.length} active habits. Rings are shared from here on (up to 4 habits
            per ring). Fewer habits are easier to stick to.
            {ringLayout.hiddenCount > 0 &&
              ` +${ringLayout.hiddenCount} more habits are not shown in the rings.`}
          </p>
        )}
        <TileDensity value={perRow} onChange={setPerRow} />
      </div>

      {actionError && (
        <p role="alert" className="text-body mb-4 rounded-input bg-danger/10 px-3 py-2 text-danger">
          {actionError}
        </p>
      )}

      {vacationToday && (
        <div
          className="glass-card fade-up mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card px-5 py-4"
          style={{ animationDelay: '20ms' }}
          role="status"
        >
          <p className="min-w-0 text-body font-medium text-fg">
            Vacation mode · habits are paused
            <span className="mt-0.5 block text-caption text-fg-muted">
              Nothing breaks a streak — check-ins still count.
            </span>
          </p>
          <button
            type="button"
            onClick={resumeVacation}
            className="inline-flex h-11 shrink-0 items-center rounded-pill bg-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
          >
            Resume
          </button>
        </div>
      )}

      {/* Bento row 1: hero (rings) + weekly completion */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <section className="glass-card fade-up rounded-card p-5 lg:col-span-5 lg:p-6">
          <div className="flex flex-col items-center gap-5 lg:flex-row lg:gap-6">
            <div className="w-full max-w-[220px] shrink-0 self-center lg:max-w-[200px]">
              <ProgressRings
                habits={habits}
                entriesByHabit={entriesByHabit}
                date={selectedDate}
                caption={vacationToday ? 'habits are paused' : isPast ? 'done that day' : 'done today'}
                paused={vacationToday && selectedDate === today}
                vacations={vacationDays}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body text-fg-secondary">{motivational}</p>
              <span
                className="mt-4 inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3"
                style={{ height: 36 }}
                title="Longest active streak"
              >
                <IconFlame className="size-4 text-accent" />
                <span className="text-caption text-fg-muted">longest streak</span>
                <span className="text-caption tabular-nums text-fg">{overallStreak}</span>
              </span>
            </div>
          </div>
        </section>

        <div className="lg:col-span-7">
          <CompletionCard habits={habits} entriesByHabit={entriesByHabit} today={today} vacations={vacationDays} />
        </div>
      </div>

      {/* Bento row 2: habit tiles (sortable grid; long-press enters jiggle mode) */}
      <HabitReorderGrid
        habits={habits}
        entriesByHabit={entriesByHabit}
        selectedDate={selectedDate}
        today={today}
        vacations={vacationDays}
        perRow={perRow}
        reorderMode={reorderMode}
        enterReorderMode={() => setReorderMode(true)}
        reorderHabits={reorderHabits}
        onNotice={(kind, text) => setNotice({ kind, text })}
        onToggle={toggle}
        onLogValue={logValue}
        onSkip={skip}
      />

      {/* Reorder toast: "Order saved" or the rollback error message. */}
      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center lg:bottom-6"
        >
          <p
            className={`glass-pill rounded-pill px-5 py-2.5 text-body font-medium ${
              notice.kind === 'success' ? 'text-success' : 'text-danger'
            }`}
          >
            {notice.text}
          </p>
        </div>
      )}
    </section>
  )
}
