import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabits, extractError } from '../hooks/useHabits'
import { useEntries } from '../hooks/useEntries'
import { currentStreak, isDone, type Entry, type Habit } from '../lib/score'
import { addDays, todayString } from '../lib/dates'
import { HabitRow } from '../components/HabitRow'

function upsertEntry(list: Entry[], entry: Entry): Entry[] {
  const i = list.findIndex((e) => e.date === entry.date)
  if (i === -1) return [...list, entry]
  const copy = list.slice()
  copy[i] = entry
  return copy
}

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

  const pageError = habitsError ?? entriesError
  if (pageError) {
    return (
      <section>
        <h1 className="text-page-title">Today</h1>
        <div className="mt-6 rounded-card border border-danger bg-danger/10 p-6 text-center" role="alert">
          <p className="text-body text-danger">{pageError}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 h-11 rounded-button border border-danger px-4 text-body font-medium text-danger"
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
        <div className="mt-6 grid place-items-center rounded-card border border-border bg-surface-raised p-10" role="status">
          <span className="text-body text-fg-muted">Loading…</span>
        </div>
      </section>
    )
  }

  if (habits.length === 0) {
    return (
      <section>
        <h1 className="text-page-title">Today</h1>
        <div className="mt-6 rounded-card border border-border bg-surface-raised p-6 text-center">
          <p className="text-body text-fg-secondary">No habits yet.</p>
          <p className="mt-1 text-caption text-fg-muted">
            Create your first habit to start tracking.
          </p>
          <Link
            to="/habits/new"
            className="mt-4 inline-flex h-11 items-center rounded-button bg-accent px-4 text-body font-semibold text-white"
          >
            Add habit
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-page-title">Today</h1>
        <Link
          to="/habits/new"
          className="inline-flex h-11 shrink-0 items-center rounded-button bg-accent px-4 text-body font-semibold text-white"
        >
          Add habit
        </Link>
      </div>

      {/* Backfill control: nudge back a day or pick any past date */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="h-11 shrink-0 rounded-button border border-border bg-surface px-3 text-body font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-raised"
          aria-label="Go to previous day"
        >
          ‹ Prev
        </button>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          aria-label="Pick a date to log"
          className="h-11 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-body text-fg"
        />
        {isPast && (
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="h-11 shrink-0 rounded-button bg-accent px-3 text-body font-semibold text-white"
          >
            Today
          </button>
        )}
      </div>
      {isPast && <p className="mt-2 text-caption text-fg-muted">Logging for {selectedDate}</p>}

      {habits.length > 7 && (
        <p className="mt-4 text-caption text-fg-muted">
          You have {habits.length} active habits — keeping it under 7 makes them easier to stick to.
        </p>
      )}

      {actionError && (
        <p role="alert" className="mt-4 rounded-button bg-danger/10 px-3 py-2 text-caption text-danger">
          {actionError}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {habits.map((habit) => {
          const list = entriesByHabit[habit.id] ?? []
          const entry = list.find((e) => e.date === selectedDate)
          return (
            <HabitRow
              key={habit.id}
              habit={habit}
              done={entry != null && isDone(habit, entry)}
              streak={currentStreak(habit, list, today)}
              value={entry ? entry.value : null}
              onToggle={() => toggle(habit)}
              onLogValue={(v) => logValue(habit, v)}
            />
          )
        })}
      </ul>
    </section>
  )
}