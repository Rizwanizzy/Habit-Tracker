import { useState } from 'react'
import { Link } from 'react-router-dom'
import { extractError } from '../hooks/useHabits'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
import { IconPencil } from '../components/icons'
import type { Habit } from '../lib/score'

function ManageRow({
  habit,
  busy,
  onToggleArchive,
}: {
  habit: Habit
  busy: boolean
  onToggleArchive: (h: Habit) => void
}) {
  const archived = habit.archived === true
  return (
    <li className="flex min-h-[64px] items-center gap-3 rounded-input border border-border bg-surface-raised px-3 py-2">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color ?? '#3B82F6' }}
      />
      <Link
        to={`/habits/${habit.id}/edit`}
        className="text-body flex h-11 min-w-0 flex-1 items-center truncate font-medium text-fg hover:underline"
        title={habit.name}
      >
        {habit.name}
      </Link>
      {archived && (
        <span className="text-caption shrink-0 rounded-pill px-2 py-0.5 text-fg-muted" style={{ backgroundColor: 'var(--surface)' }}>
          Archived
        </span>
      )}
      <Link
        to={`/habits/${habit.id}/edit`}
        aria-label={`Edit ${habit.name}`}
        className="grid size-11 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-150 hover:bg-surface hover:text-fg"
      >
        <IconPencil className="size-4" />
      </Link>
      <button
        type="button"
        onClick={() => onToggleArchive(habit)}
        disabled={busy}
        className="glass-pill h-11 shrink-0 rounded-pill px-4 text-body font-medium text-fg-secondary transition-colors duration-150 hover:text-fg disabled:opacity-60"
      >
        {archived ? 'Restore' : 'Archive'}
      </button>
    </li>
  )
}

export function Settings() {
  const { session } = useAuth()
  const { habits, loading, error, reload, archiveHabit } = useHabitsContext()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  async function toggleArchive(h: Habit) {
    setActionError(null)
    setBusy(true)
    try {
      await archiveHabit(h.id, !h.archived)
    } catch (e) {
      setActionError(extractError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <header className="mb-5">
        <h1 className="text-page-title">Settings</h1>
        <p className="text-caption mt-1 text-fg-muted">Appearance, habits and account</p>
      </header>

      {/* Two columns on desktop (DESIGN.md §8): Appearance + Account left,
          Habits right. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="flex flex-col gap-4 lg:gap-5">
          <div className="glass-card fade-up rounded-card p-6">
            <h2 className="text-section-title">Appearance</h2>
            <p className="text-caption mt-1 text-fg-muted">Light or dark, saved on this device</p>
            <div className="mt-4">
              <ThemeToggle />
            </div>
          </div>

          <div className="glass-card fade-up rounded-card p-6" style={{ animationDelay: '80ms' }}>
            <h2 className="text-section-title">Account</h2>
            <p className="text-caption mt-1 text-fg-muted">Signed in as {session?.user.email ?? 'unknown'}</p>
            <Link
              to="/profile"
              className="mt-2 inline-flex h-11 items-center rounded-pill px-4 text-body font-medium text-accent hover:underline"
            >
              View profile
            </Link>
          </div>
        </div>

        <div className="glass-card fade-up rounded-card p-6" style={{ animationDelay: '40ms' }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-section-title">Habits</h2>
            {habits.length > 0 && (
              <p className="text-caption text-fg-muted">
                {active.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ''}
              </p>
            )}
          </div>

          {loading ? (
            <div className="mt-4 grid place-items-center p-6" role="status">
              <span className="text-body text-fg-muted">Loading…</span>
            </div>
          ) : error ? (
            <div className="mt-4 rounded-input bg-danger/10 px-3 py-3" role="alert">
              <p className="text-body text-danger">{error}</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="glass-pill mt-3 h-11 rounded-pill px-4 text-body font-medium text-fg"
              >
                Retry
              </button>
            </div>
          ) : habits.length === 0 ? (
            <div className="mt-4 text-center">
              <p className="text-body text-fg-secondary">No habits yet — add one from Today.</p>
              <Link
                to="/"
                className="glass-pill mt-4 inline-flex h-11 items-center rounded-pill px-4 text-body font-medium text-fg"
              >
                Go to Today
              </Link>
            </div>
          ) : (
            <>
              {actionError && (
                <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-body text-danger">
                  {actionError}
                </p>
              )}
              <ul className="mt-4 flex flex-col gap-2">
                {active.map((h) => (
                  <ManageRow key={h.id} habit={h} busy={busy} onToggleArchive={(h) => void toggleArchive(h)} />
                ))}
              </ul>
              {archived.length > 0 && (
                <>
                  <p className="text-caption mt-6 text-fg-muted">Archived</p>
                  <p className="mt-1 text-body text-fg-secondary">
                    Hidden from Today and Overview; history is kept.
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {archived.map((h) => (
                      <ManageRow key={h.id} habit={h} busy={busy} onToggleArchive={(h) => void toggleArchive(h)} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
