import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { extractError } from '../hooks/useHabits'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useEntries } from '../hooks/useEntries'
import { currentStreak, isDone, type Entry, type Habit } from '../lib/score'
import { addDays, formatDayStart, parseLocalDate, toLocalDateString } from '../lib/dates'
import { isVacationDay, vacationDatesInRange } from '../lib/vacation'
import { useVacationsContext } from '../contexts/VacationsContext'
import { now } from '../lib/clock'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { useScheduleHistory } from '../hooks/useScheduleHistory'
import { useSettings } from '../contexts/SettingsContext'
import { todayPair } from '../lib/todaySummary'
import { buildWeekStrip } from '../lib/weekStrip'
import { layoutRings } from '../lib/rings'
import { ThemeIconButton } from '../components/ThemeIconButton'
import { ProgressRings } from '../components/ProgressRings'
import { CompletionCard } from '../components/CompletionCard'
import { TileDensity } from '../components/TileDensity'
import { HabitReorderGrid } from '../components/HabitReorderGrid'
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconFlame } from '../components/icons'
import { TodayGreeting } from '../components/TodayGreeting'
import { WeekStrip } from '../components/WeekStrip'
import { HabitMatrix } from '../components/HabitMatrix'
import { RingExplainer } from '../components/RingExplainer'
import { buildHabitMatrix } from '../lib/habitMatrix'

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

// Short label for the date pill (design-system MASTER.md §3.3): must fit
// between the chevrons on a 360px screen.
const PILL_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
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

  // Schedule epochs (Stage 4A): the user's habit_schedule_history rows, RLS-
  // scoped, grouped per habit. With them, off-days become neutral,
  // weekly-target habits go week-scoped, and streaks/denominators follow the
  // schedule rules. No epochs (pre-migration probe) = exact legacy behaviour.
  const { epochsByHabit, loading: scheduleLoading, error: scheduleError } = useScheduleHistory()

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
  // View mode toggle (Feature A): 'scheduled' (default) uses Stage 4E filtering;
  // 'all' shows every active habit. Only affects tile visibility — rings/stats
  // remain governed by scheduling rules.
  const [viewMode, setViewMode] = useState<'scheduled' | 'all'>('scheduled')

  // Stage 2 (UI 2.0): Tiles (default) or read-only weekly Matrix view for the
  // habit section. Persisted like the other Today preferences; switching to
  // Matrix exits reorder mode (reordering is a Tiles-only capability — see
  // changeGridMode below).
  const [gridMode, setGridMode] = useState<'tiles' | 'matrix'>(() => {
    try {
      return localStorage.getItem('today-grid-mode') === 'matrix' ? 'matrix' : 'tiles'
    } catch {
      return 'tiles'
    }
  })

  // Tiles-per-row density (1–6): the user's grid-width preference — no code
  // changes needed to rearrange rows. Persisted, validated on read, and it now
  // drives the grid on phones too. The first-run default adapts to the screen
  // (phones 2-up, tablets 3-up, desktop 5-up); a stored value only wins when
  // the user actually used the stepper (`tile-columns-set`), because older
  // builds also stored their 5-column default on phones.
  const [perRow, setPerRow] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('tile-columns')
      if (localStorage.getItem('tile-columns-set') === '1' && stored && /^[1-6]$/.test(stored)) {
        return Number(stored)
      }
    } catch {
      // Storage disabled: fall through to the width-based default.
    }
    if (typeof window === 'undefined') return 5
    if (window.innerWidth < 640) return 2
    if (window.innerWidth < 1024) return 3
    return 5
  })

  const updatePerRow = (next: number) => {
    setPerRow(next)
    try {
      localStorage.setItem('tile-columns-set', '1')
    } catch {
      // Storage disabled: the choice just doesn't persist.
    }
  }
  useEffect(() => {
    try {
      localStorage.setItem('tile-columns', String(perRow))
    } catch {
      // Storage disabled: the choice just doesn't persist.
    }
  }, [perRow])

  // Matrix habit-name pane width level (1–4): independent from Tiles per-row,
  // persisted under its own key. Level 1 = production pane; each step adds
  // one date-column width. Restored safely with clamping; default is 1 for
  // users without a saved Matrix preference.
  const [matrixNameWidth, setMatrixNameWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('matrix-name-width')
      if (stored && /^[1-4]$/.test(stored)) return Number(stored)
    } catch {
      // Storage disabled: fall through to default.
    }
    return 1
  })

  const updateMatrixNameWidth = (next: number) => {
    setMatrixNameWidth(next)
    try {
      localStorage.setItem('matrix-name-width', String(next))
    } catch {
      // Storage disabled: the choice just doesn't persist.
    }
  }

  // --- Reorder (jiggle) mode -------------------------------------------------
  // Long-press (350ms, 8px tolerance on both pointer and touch) lifts the tile
  // and enters the mode; a pointerdown outside a tile (or Escape) exits it.
  // Drag/drop saves the new order through reorderHabits (optimistic, rolls
  // back on failure). The header shows only a hint — there is no Done button.
  const [reorderMode, setReorderMode] = useState(false)
  const exitReorderMode = useCallback(() => setReorderMode(false), [])
  const [notice, setNotice] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null)

  // Stage 2: Tiles/Matrix switch. Matrix has its own handle-based row
  // reordering (no wiggle mode), so leaving the Tiles jiggle mode on switch
  // keeps the two views' interaction models clean.
  const changeGridMode = useCallback(
    (mode: 'tiles' | 'matrix') => {
      setGridMode(mode)
      try {
        localStorage.setItem('today-grid-mode', mode)
      } catch {
        // Storage disabled: the choice just doesn't persist.
      }
      if (mode === 'matrix' && reorderMode) exitReorderMode()
    },
    [reorderMode, exitReorderMode],
  )

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

  /** Check-in handlers (Stage 2 refinement): now parameterized by date so the
   *  weekly Matrix can toggle/edit any cell of the displayed week through the
   *  SAME pipeline; Tiles omit the argument and keep operating on the
   *  selected day. Optimistic apply + rollback live in applyLocal above. */
  function toggle(habit: Habit, date: string = selectedDate) {
    const existing = (entriesByHabit[habit.id] ?? []).find((e) => e.date === date)
    const markingDone = !(existing && isDone(habit, existing))
    const value = habit.type === 'numeric' ? habit.target : 1
    void applyLocal(
      habit,
      (prev) =>
        markingDone
          ? upsertEntry(prev, { date, value, status: 'done' })
          : prev.filter((e) => e.date !== date),
      () => (markingDone ? saveEntry(habit.id, date, value) : removeEntry(habit.id, date)),
    )
  }

  function logValue(habit: Habit, value: number, date: string = selectedDate) {
    void applyLocal(
      habit,
      (prev) => upsertEntry(prev, { date, value, status: 'done' }),
      () => saveEntry(habit.id, date, value),
    )
  }

  /** Skip this habit on the selected day (neutral — no streak break, no
   *  score drop): upserts a status-'skipped' row; undo deletes the row.
   *  Checking in on a skipped day stays possible through toggle (upserts
   *  status 'done'). Only a day without a done entry can be skipped. */
  function skip(habit: Habit, date: string = selectedDate) {
    const existing = (entriesByHabit[habit.id] ?? []).find((e) => e.date === date)
    if (existing && isDone(habit, existing)) return
    const skipping = !(existing && existing.status === 'skipped')
    void applyLocal(
      habit,
      (prev) =>
        skipping
          ? upsertEntry(prev, { date, value: 0, status: 'skipped' })
          : prev.filter((e) => e.date !== date),
      () => (skipping ? skipEntry(habit.id, date) : removeEntry(habit.id, date)),
    )
  }

  function resumeVacation() {
    if (!activeVacation) return
    setActionError(null)
    void vacationsStore.endVacation(activeVacation.id)
  }

  /** Longest active streak across habits — the hero card's "overall streak".
   *  Epoch-aware (Stage 4A): off-days neither count nor break; weekly targets
   *  count achieved weeks instead of calendar days. */
  const overallStreak = useMemo(
    () =>
      habits.reduce((best, h) => {
        const s = currentStreak(h, entriesByHabit[h.id] ?? [], today, vacationDays, epochsByHabit[h.id])
        return s > best ? s : best
      }, 0),
    [habits, entriesByHabit, today, vacationDays, epochsByHabit],
  )

  // Hero pair comes from the shared todayPair helper (src/lib/todaySummary.ts):
  // ALL active habits count — weekly-target habits included while their week
  // is pending (and on check-in/achievement days), dropping out once the
  // weekly goal is achieved; neutral days (skipped/vacation/unscheduled) and
  // before-start days are excluded. Never a 0% miss. This deliberately does
  // NOT read the Scheduled/All-Habits toggle: view switching cannot change
  // the summary. (Overview/heatmap daily stats keep their week-scoped math —
  // documented divergence.)
  const pair = useMemo(
    () =>
      todayPair({
        habits,
        entriesByHabit,
        date: selectedDate,
        vacations: vacationDays,
        epochsByHabit,
      }),
    [habits, entriesByHabit, selectedDate, vacationDays, epochsByHabit],
  )
  const doneToday = pair.done
  const totalToday = pair.total
  const skippedToday = pair.neutralCount

  // Hero + ring-center share one caption (vacation/paused and all-skipped
  // states preserved; no weekly-habits suffix).
  const doneCaption =
    vacationToday && selectedDate === today
      ? 'habits are paused'
      : skippedToday === habits.length && habits.length > 0
        ? 'all habits skipped'
        : isPast
          ? 'done that day'
          : 'done today'

  // Stage 1A (UI 2.0): the seven-day strip's cells come from the SAME data
  // the hero uses — no extra fetching (useEntries covers 365 days back,
  // vacation dates 400 days back, epochs are full history) — and reuse the
  // approved todayPair metric per day via buildWeekStrip.
  const weekStripCells = useMemo(
    () =>
      buildWeekStrip({
        habits,
        entriesByHabit,
        today,
        selectedDate,
        vacations: vacationDays,
        epochsByHabit,
      }),
    [habits, entriesByHabit, today, selectedDate, vacationDays, epochsByHabit],
  )

  // Stage 2 (UI 2.0): weekly matrix data — same sources as the hero/strip,
  // no extra fetching; dayStatus + shouldShowHabitOnDate do ALL classification
  // and eligibility (lib/habitMatrix.ts is pure). The week is the selected
  // date's Monday–Sunday week (same anchor as the strip above).
  const matrixData = useMemo(
    () =>
      buildHabitMatrix({
        habits,
        entriesByHabit,
        today,
        selectedDate,
        viewMode,
        vacations: vacationDays,
        epochsByHabit,
      }),
    [habits, entriesByHabit, today, selectedDate, viewMode, vacationDays, epochsByHabit],
  )

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
  const pillDateLabel = PILL_FMT.format(parseLocalDate(selectedDate))

  const pageError = habitsError ?? entriesError ?? scheduleError
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

  if (habitsLoading || entriesLoading || scheduleLoading) {
    return (
      <section>
        <TodayGreeting />
        <div className="mt-6 grid gap-6">
          <div className="glass-card rounded-card p-6">
            <div className="flex flex-col gap-4">
              <div className="h-48 w-full rounded-xl bg-fg/10 animate-pulse" />
              <div className="h-12 w-2/3 rounded-xl bg-fg/10 animate-pulse" />
              <div className="flex gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-24 w-full rounded-full bg-fg/10 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, r) => (
              <div
                key={r}
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
                  gap: perRow >= 5 ? 8 : perRow >= 3 ? 12 : 16,
                }}
              >
                {Array.from({ length: perRow }).map((_, c) => (
                  <div key={c} className="glass-card rounded-tile p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-fg/10 animate-pulse" />
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="h-4 w-3/4 rounded-xl bg-fg/10 animate-pulse" />
                        <div className="h-3 w-1/2 rounded-xl bg-fg/10 animate-pulse" />
                      </div>
                      <div className="h-10 w-10 rounded-full bg-fg/10 animate-pulse" />
                    </div>
                    <div className="mt-3 h-8 w-full rounded-full bg-fg/10 animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
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
      {/* Mobile header (below lg): two rows */}
      <header className="mb-3 flex flex-col gap-3 lg:hidden">
        {/* Row 1 (flex, items-center, justify-between, 44px high) */}
        <div className="flex h-11 items-center justify-between gap-3">
          <TodayGreeting compact reorderMode={reorderMode} />
          {reorderMode ? (
            <button
              type="button"
              onClick={exitReorderMode}
              className="bg-accent-gradient glow-accent inline-flex h-11 items-center justify-center rounded-pill px-5 text-body font-semibold text-white transition-all duration-150 active:scale-95"
            >
              Done
            </button>
          ) : (
            <ThemeIconButton disabled={reorderMode} className="size-11" />
          )}
        </div>

        {/* Row 2: date navigation pill (50% / 65% past) and per-row density stepper (50% / 35% past) */}
        <div className="w-full">
          <div className="flex w-full items-center gap-2">
            <div
              role="group"
              aria-label="Date navigation"
              className={`glass-pill flex h-11 sm:h-12 items-center justify-between rounded-pill p-1 transition-[flex-grow,flex-basis] duration-150 ${
                isPast ? 'flex-[65] basis-[65%] min-w-0' : 'flex-1 basis-1/2 min-w-0'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                aria-label="Previous day"
                className="relative grid size-8 sm:size-9 shrink-0 place-items-center rounded-pill text-fg-secondary transition-colors duration-150 hover:text-fg after:absolute after:inset-[-6px] after:content-['']"
              >
                <IconChevronLeft className="size-4 sm:size-5" />
              </button>

              <div className="relative flex flex-1 items-center justify-center min-w-0 h-full">
                <div
                  aria-hidden="true"
                  className="pointer-events-none flex h-9 sm:h-10 items-center justify-center gap-1 rounded-pill px-1 sm:px-2 text-[12px] sm:text-caption font-medium text-fg max-w-full min-w-0"
                >
                  <span className="truncate">{pillDateLabel}</span>
                  <IconChevronDown className="size-3.5 sm:size-4 shrink-0 text-fg-muted" />
                </div>
                {/* Transparent input overlay: user tap hits native input directly, opening OS picker without programmatic showPicker() */}
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  aria-label={`Pick a date to log, ${dateLabel}`}
                  className="absolute inset-0 h-full w-full cursor-pointer rounded-pill opacity-0"
                />
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                {isPast && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(today)}
                    className="text-[11px] sm:text-caption h-7 sm:h-8 rounded-pill bg-accent px-1.5 sm:px-2 font-medium text-white transition-all duration-150 hover:brightness-110 active:scale-95"
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  disabled={isPast === false}
                  aria-label="Next day"
                  className="relative grid size-8 sm:size-9 place-items-center rounded-pill text-fg-secondary transition-colors duration-150 hover:text-fg disabled:opacity-40 after:absolute after:inset-[-6px] after:content-['']"
                >
                  <IconChevronRight className="size-4 sm:size-5" />
                </button>
              </div>
            </div>

            {gridMode === 'tiles' ? (
              <TileDensity
                value={perRow}
                onChange={updatePerRow}
                className={`h-11 sm:h-12 transition-[flex-grow,flex-basis] duration-150 justify-center ${
                  isPast ? 'flex-[35] basis-[35%] min-w-0' : 'flex-1 basis-1/2 min-w-0'
                }`}
              />
            ) : (
              <TileDensity
                value={matrixNameWidth}
                onChange={updateMatrixNameWidth}
                label="Habit names"
                max={4}
                groupLabel="Habit name pane width"
                minusLabel="Narrower habit names"
                plusLabel="Wider habit names"
                className={`h-11 sm:h-12 transition-[flex-grow,flex-basis] duration-150 justify-center ${
                  isPast ? 'flex-[35] basis-[35%] min-w-0' : 'flex-1 basis-1/2 min-w-0'
                }`}
              />
            )}
          </div>

          {dayShifted && (
            <p className="text-caption mt-1.5 text-center text-fg-muted">
              Counting as {todayLabel} until {formatDayStart(dayStartHour)}
            </p>
          )}
        </div>
      </header>

      {/* Desktop header (lg+): exact original single row */}
      <header className="mb-5 hidden lg:flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <TodayGreeting />
          {dayShifted && (
            <p className="text-caption text-fg-muted lg:flex-1 lg:text-center">
              Counting as {todayLabel} until {formatDayStart(dayStartHour)}
            </p>
          )}
        </div>
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
            <div className="relative flex items-center justify-center min-w-[5.5rem] h-11">
              <div
                aria-hidden="true"
                className="pointer-events-none flex h-11 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-pill px-2.5 text-body text-fg"
              >
                <span className="truncate">{pillDateLabel}</span>
                <IconChevronDown className="size-4 shrink-0 text-fg-muted" />
              </div>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                aria-label={`Pick a date to log, ${dateLabel}`}
                className="absolute inset-0 h-full w-full cursor-pointer rounded-pill opacity-0"
              />
            </div>
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
            <span className="text-caption shrink-0 text-fg-muted">
              Drag to reorder · tap outside to finish
            </span>
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

      {/* Desktop: Tiles/Matrix switch | Scheduled/All toggle + Per row (matching-height pills).
          The persistent ">7 habits / shared rings" note was removed in Stage 2 — the ring
          explainer popover (RingExplainer, on the hero rings) now carries that explanation. */}
      <div className="mb-4 hidden lg:flex lg:flex-nowrap items-center justify-end gap-3">
        {/* RIGHT: Tiles/Matrix + Scheduled/All + Per row - matching height pills */}
        <div className="flex items-center gap-2 shrink-0">
          <div role="group" aria-label="Grid view" className="glass-pill inline-flex items-center gap-0.5 rounded-pill p-1">
            <button
              type="button"
              onClick={() => changeGridMode('tiles')}
              aria-pressed={gridMode === 'tiles'}
              className={`relative grid h-9 place-items-center rounded-pill px-3 text-caption font-medium transition-all duration-150 ${
                gridMode === 'tiles'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Tiles
            </button>
            <button
              type="button"
              onClick={() => changeGridMode('matrix')}
              aria-pressed={gridMode === 'matrix'}
              className={`relative grid h-9 place-items-center rounded-pill px-3 text-caption font-medium transition-all duration-150 ${
                gridMode === 'matrix'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Matrix
            </button>
          </div>
          <div role="group" aria-label="Habit view" className="glass-pill inline-flex items-center gap-0.5 rounded-pill p-1">
            <button
              type="button"
              onClick={() => setViewMode('scheduled')}
              aria-pressed={viewMode === 'scheduled'}
              className={`relative grid h-9 place-items-center rounded-pill px-3 text-caption font-medium transition-all duration-150 ${
                viewMode === 'scheduled'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Scheduled
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              aria-pressed={viewMode === 'all'}
              className={`relative grid h-9 place-items-center rounded-pill px-3 text-caption font-medium transition-all duration-150 ${
                viewMode === 'all'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              All Habits
            </button>
          </div>
          {gridMode === 'tiles' ? (
            <TileDensity value={perRow} onChange={updatePerRow} />
          ) : (
            <TileDensity
              value={matrixNameWidth}
              onChange={updateMatrixNameWidth}
              label="Habit names"
              max={4}
              groupLabel="Habit name pane width"
              minusLabel="Narrower habit names"
              plusLabel="Wider habit names"
            />
          )}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-body mb-3 lg:mb-4 rounded-input bg-danger/10 px-3 py-2 text-danger">
          {actionError}
        </p>
      )}

      {vacationToday && (
        <div
          className="glass-card fade-up mb-3 lg:mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card px-4 py-3.5 lg:px-5 lg:py-4"
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

      {/* Stage 1A (UI 2.0): interactive seven-day strip for the selected
          week (Mon–Sun). Tapping a day updates the same selectedDate state
          as the chevrons/date pill above; future days are disabled. */}
      <div className="mb-3 lg:mb-5">
        <WeekStrip cells={weekStripCells} onSelect={setSelectedDate} />
      </div>

      {/* Bento grid (desktop) / Stack (mobile):
          Order: 1. Hero rings -> 2. Completion card (Week/Month/Year) -> 3. Habit tiles.
          Desktop layout: Row 1 = Hero (5 cols) + Completion card (7 cols), Row 2 = Habit tiles (12 cols). */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-5">
        {/* Hero card. `relative` anchors the RingExplainer info overlay to the
            card's top-right corner (its existing empty space) without any
            in-flow space — card height/geometry stay identical to production. */}
        <section className="glass-card fade-up rounded-card relative p-4 lg:col-span-5 lg:p-6">
          <div className="flex flex-row items-center gap-4 lg:gap-6">
            {/* Mobile Left stat block (hidden on lg+) */}
            <div className="min-w-0 flex-1 lg:hidden">
              {vacationToday && selectedDate === today ? (
                <p className="font-display text-[28px] sm:text-[34px] font-bold leading-none text-fg">
                  Paused
                </p>
              ) : totalToday === 0 && habits.length > 0 ? (
                <p className="font-display text-[22px] sm:text-[28px] font-bold leading-tight text-fg">
                  All caught up.
                </p>
              ) : (
                <p className="font-display text-[38px] sm:text-[40px] leading-none tabular-nums font-bold text-fg">
                  {doneToday} / {totalToday}
                </p>
              )}
              <p className="text-caption mt-1 text-fg-muted break-words">{doneCaption}</p>
              {motivational && totalToday !== 0 && (
                <p className="text-[14px] leading-snug text-fg-secondary line-clamp-2 mt-1.5 break-words">
                  {motivational}
                </p>
              )}
              <div className="mt-2.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-caption text-fg-muted whitespace-nowrap"
                  title="Longest active streak"
                >
                  <IconFlame className="size-3.5 text-accent" />
                  <span>Best streak</span>
                  <span className="tabular-nums font-semibold text-fg">{overallStreak}</span>
                </span>
              </div>
            </div>

            {/* ProgressRings (both viewports: Right on mobile via order-2, Left on desktop via lg:order-1).
                Stage 2: the persistent ">7 habits" note moved into the dismissible RingExplainer,
                which is now a card-corner overlay OUTSIDE this container — production container
                size (and thus ring size and card height) fully restored. */}
            <div className="relative size-[120px] sm:size-[140px] shrink-0 order-2 lg:order-1 lg:size-auto lg:w-full lg:max-w-[200px] lg:self-center">
              <ProgressRings
                habits={habits}
                entriesByHabit={entriesByHabit}
                date={selectedDate}
                caption={doneCaption}
                paused={vacationToday && selectedDate === today}
                vacations={vacationDays}
                epochsByHabit={epochsByHabit}
              />
            </div>

            {/* Desktop Right stat block (hidden below lg) */}
            <div className="hidden lg:block min-w-0 flex-1 lg:order-2">
              <p className="text-body text-fg-secondary line-clamp-2 break-words">{motivational}</p>
              <span
                className="mt-4 inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3"
                style={{ height: 36 }}
                title="Longest active streak"
              >
                <IconFlame className="size-4 text-accent" />
                <span className="text-caption text-fg-muted">Best streak</span>
                <span className="text-caption tabular-nums text-fg">{overallStreak}</span>
              </span>
            </div>
          </div>

          {/* Info button: card-anchored overlay in the existing top-right empty
              space (8px inset from the card edges). Its popover opens below it
              and, via the .ring-explainer-open class + index.css :has() rule,
              the whole card lifts above the heatmap card while it is open. */}
          <RingExplainer hiddenCount={ringLayout.hiddenCount} />
        </section>

        {/* Completion card */}
        <div className="w-full lg:col-span-7">
          <CompletionCard
            habits={habits}
            entriesByHabit={entriesByHabit}
            today={today}
            vacations={vacationDays}
            scheduleByHabit={epochsByHabit}
          />
        </div>

        {/* Mobile: Tiles/Matrix switch (left) + Scheduled/All toggle (right) */}
        <div className="lg:hidden mb-2 flex items-center justify-between gap-2">
          <div role="group" aria-label="Grid view" className="glass-pill flex items-center rounded-pill p-0.5">
            <button
              type="button"
              onClick={() => changeGridMode('tiles')}
              aria-pressed={gridMode === 'tiles'}
              className={`relative flex h-8 items-center rounded-pill px-2.5 text-[11px] font-medium transition-all duration-150 after:absolute after:inset-y-[-4px] after:inset-x-1 after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                gridMode === 'tiles'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Tiles
            </button>
            <button
              type="button"
              onClick={() => changeGridMode('matrix')}
              aria-pressed={gridMode === 'matrix'}
              className={`relative flex h-8 items-center rounded-pill px-2.5 text-[11px] font-medium transition-all duration-150 after:absolute after:inset-y-[-4px] after:inset-x-1 after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                gridMode === 'matrix'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Matrix
            </button>
          </div>
          <div role="group" aria-label="Habit view" className="glass-pill flex items-center rounded-pill p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('scheduled')}
              aria-pressed={viewMode === 'scheduled'}
              className={`relative flex h-8 items-center rounded-pill px-2.5 text-[11px] font-medium transition-all duration-150 after:absolute after:inset-y-[-4px] after:inset-x-1 after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                viewMode === 'scheduled'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Scheduled
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              aria-pressed={viewMode === 'all'}
              className={`relative flex h-8 items-center rounded-pill px-2.5 text-[11px] font-medium transition-all duration-150 after:absolute after:inset-y-[-4px] after:inset-x-1 after:rounded-pill after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                viewMode === 'all'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              All Habits
            </button>
          </div>
        </div>

        {/* Habit section: Tiles (default, full reorder/check-in functionality)
            or the Stage 2 interactive weekly Matrix — the switch is above.
            The Matrix reuses the SAME handlers (toggle/logValue/skip), so
            check-ins made here flow through the shared entriesByHabit state
            and instantly update hero, rings, week strip and Tiles. */}
        <div className="w-full lg:col-span-12">
          {gridMode === 'matrix' ? (
            <HabitMatrix
              data={matrixData}
              habits={habits}
              onReorder={reorderHabits}
              onNotice={(kind, text) => setNotice({ kind, text })}
              onToggle={toggle}
              onLogValue={logValue}
              onSkip={skip}
              nameWidth={matrixNameWidth}
            />
          ) : (
            <HabitReorderGrid
            habits={habits}
            entriesByHabit={entriesByHabit}
            selectedDate={selectedDate}
            today={today}
            vacations={vacationDays}
            epochsByHabit={epochsByHabit}
            perRow={perRow}
            reorderMode={reorderMode}
            viewMode={viewMode}
            enterReorderMode={() => setReorderMode(true)}
            exitReorderMode={exitReorderMode}
            reorderHabits={reorderHabits}
            onNotice={(kind, text) => setNotice({ kind, text })}
            onToggle={toggle}
            onLogValue={logValue}
            onSkip={skip}
            />
          )}
        </div>
      </div>

      {/* Reorder toast: "Order saved" or the rollback error message — pinned
          under the page header, not the bottom edge (see Profile toast). */}
      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 top-[4rem] z-40 flex justify-center lg:top-[4.5rem]"
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
