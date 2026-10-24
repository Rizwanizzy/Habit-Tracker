import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabits, extractError } from '../hooks/useHabits'
import { useEntries } from '../hooks/useEntries'
import { currentStreak, isDone, type Entry, type Habit } from '../lib/score'
import { addDays, parseLocalDate, todayString } from '../lib/dates'
import { ProgressRings } from '../components/ProgressRings'
import { WeeklyCompletion } from '../components/WeeklyCompletion'
import { HabitTile } from '../components/HabitTile'
import { IconChevronLeft, IconChevronRight, IconFlame } from '../components/icons'

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
  const { habits, loading: habitsLoading, error: habitsError, reload } = useHabits()
  const ids = habits.map((h) => h.id)
  const {
    entriesByHabit,
    loading: entriesLoading,
    error: entriesError,
    saveEntry,
    removeEntry,
    setEntriesByHabit,
  } = useEntries(ids)

  const today = todayString()
  const [selectedDate, setSelectedDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isPast = selectedDate !== today

  /** Optimistic apply; revert the snapshot and surface the error if sync fails. */
  async function applyLocal(
    habit: Habit,
    mutate: (prev: Entry[]) => Entry[],
    remote: () => Promise<unknown>,
  ) {
    if (busy) return
    setBusy(true)
    setActionError(null)
    const prev = entriesByHabit[habit.id] ?? []
    setEntriesByHabit((map) => ({ ...map, [habit.id]: mutate(prev) }))
    try {
      await remote()
    } catch (e) {
      setEntriesByHabit((map) => ({ ...map, [habit.id]: prev }))
      setActionError(extractError(e))
    } finally {
      setBusy(false)
    }
  }

  function toggle(habit: Habit) {
    const existing = (entriesByHabit[habit.id] ?? []).find((e) => e.date === selectedDate)
    const markingDone = !(existing && isDone(habit, existing))
    const value = habit.type === 'numeric' ? habit.target : 1
    void applyLocal(
      habit,
      (prev) =>
        markingDone ? upsertEntry(prev, { date: selectedDate, value }) : prev.filter((e) => e.date !== selectedDate),
      () => (markingDone ? saveEntry(habit.id, selectedDate, value) : removeEntry(habit.id, selectedDate)),
    )
  }

  function logValue(habit: Habit, value: number) {
    void applyLocal(
      habit,
      (prev) => upsertEntry(prev, { date: selectedDate, value }),
      () => saveEntry(habit.id, selectedDate, value),
    )
  }

  /** Longest active streak across habits — the hero card's "overall streak". */
  const overallStreak = useMemo(
    () =>
      habits.reduce((best, h) => {
        const s = currentStreak(h, entriesByHabit[h.id] ?? [], today)
        return s > best ? s : best
      }, 0),
    [habits, entriesByHabit, today],
  )

  const doneToday = useMemo(
    () =>
      habits.filter((h) => isDone(h, (entriesByHabit[h.id] ?? []).find((e) => e.date === selectedDate)))
        .length,
    [habits, entriesByHabit, selectedDate],
  )

  const motivational =
    habits.length === 0
      ? ''
      : doneToday === habits.length
        ? 'All habits done — beautiful.'
        : doneToday === 0
          ? 'Start with one small win.'
          : `Almost there — ${habits.length - doneToday} to go.`

  const dateLabel = DATE_FMT.format(parseLocalDate(selectedDate))

  const pageError = habitsError ?? entriesError
  if (pageError) {
    return (
      <section>
        <h1 className="text-page-title">Today</h1>
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
        <h1 className="text-page-title">Today</h1>
        <div className="glass-card mt-6 grid min-h-32 place-items-center rounded-card p-10" role="status">
          <span className="text-body text-fg-muted">Loading…</span>
        </div>
      </section>
    )
  }

  if (habits.length === 0) {
    return (
      <section>
        <h1 className="text-page-title">Today</h1>
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
      {/* Header: page title + date caption on the left, date pill + primary action on the right */}
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-page-title">Today</h1>
          <p className="text-caption mt-1 text-fg-muted">{dateLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Link
            to="/habits/new"
            className="inline-flex h-12 shrink-0 items-center rounded-pill bg-accent-gradient glow-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 hover:translate-y-[-1px]"
          >
            Add habit
          </Link>
        </div>
      </header>

      {habits.length > 7 && (
        <p className="text-caption mb-4 text-fg-muted">
          You have {habits.length} active habits — rings show the first 7. Keeping it under 7 makes
          them easier to stick to.
        </p>
      )}

      {actionError && (
        <p role="alert" className="text-body mb-4 rounded-input bg-danger/10 px-3 py-2 text-danger">
          {actionError}
        </p>
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
                caption={isPast ? 'done that day' : 'done today'}
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
          <WeeklyCompletion habits={habits} entriesByHabit={entriesByHabit} today={today} />
        </div>
      </div>

      {/* Bento row 2: habit tiles */}
      <ul
        aria-label="Habits"
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-5"
      >
        {habits.map((habit, i) => {
          const list = entriesByHabit[habit.id] ?? []
          const entry = list.find((e) => e.date === selectedDate)
          return (
            <HabitTile
              key={habit.id}
              habit={habit}
              done={entry != null && isDone(habit, entry)}
              streak={currentStreak(habit, list, today)}
              value={entry ? entry.value : null}
              index={i}
              onToggle={() => toggle(habit)}
              onLogValue={(v) => logValue(habit, v)}
            />
          )
        })}
      </ul>
    </section>
  )
}
