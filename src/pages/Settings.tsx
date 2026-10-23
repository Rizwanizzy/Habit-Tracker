import { useState } from 'react'
import { useHabits, extractError } from '../hooks/useHabits'
import { getSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
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
    <li className="flex min-h-[64px] items-center gap-3 rounded-card border border-border bg-surface px-3 py-2">
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: habit.color ?? '#3B82F6' }} />
      <span className="min-w-0 flex-1 truncate text-body font-medium text-fg">
        {habit.name}
        {archived && <span className="text-caption ml-2 text-fg-muted">(archived)</span>}
      </span>
      <button
        type="button"
        onClick={() => onToggleArchive(habit)}
        disabled={busy}
        className="h-11 shrink-0 rounded-button border border-border px-3 text-body font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-raised disabled:opacity-60"
      >
        {archived ? 'Restore' : 'Archive'}
      </button>
    </li>
  )
}

export function Settings() {
  const { session } = useAuth()
  const { habits, loading, error, reload, archiveHabit } = useHabits({ includeArchived: true })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [signOutError, setSignOutError] = useState<string | null>(null)

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

  async function signOut() {
    setSignOutError(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const { error } = await sb.auth.signOut()
      if (error) throw error
      // RequireAuth listens to onAuthStateChange and redirects to /login.
    } catch (err) {
      setSignOutError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1 className="text-page-title">Settings</h1>

      <div className="mt-6 rounded-card border border-border bg-surface-raised p-6">
        <h2 className="text-section-title">Appearance</h2>
        <p className="mt-1 text-caption text-fg-muted">Switch between light and dark themes.</p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface-raised p-6">
        <h2 className="text-section-title">Habits</h2>
        {loading ? (
          <div className="mt-4 grid place-items-center p-6" role="status">
            <span className="text-body text-fg-muted">Loading…</span>
          </div>
        ) : error ? (
          <div className="mt-4 rounded-button bg-danger/10 px-3 py-2" role="alert">
            <p className="text-caption text-danger">{error}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 h-11 rounded-button border border-danger px-3 text-body font-medium text-danger"
            >
              Retry
            </button>
          </div>
        ) : habits.length === 0 ? (
          <p className="mt-4 text-body text-fg-muted">No habits yet — add one from Today.</p>
        ) : (
          <>
            {actionError && (
              <p role="alert" className="mt-4 rounded-button bg-danger/10 px-3 py-2 text-caption text-danger">
                {actionError}
              </p>
            )}
            {active.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {active.map((h) => (
                  <ManageRow key={h.id} habit={h} busy={busy} onToggleArchive={(h) => void toggleArchive(h)} />
                ))}
              </ul>
            )}
            {archived.length > 0 && (
              <>
                <h3 className="mt-6 font-medium text-fg-secondary text-body">Archived</h3>
                <p className="mt-1 text-caption text-fg-muted">
                  Hidden from Today and Overview; history is kept.
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {archived.map((h) => (
                    <ManageRow key={h.id} habit={h} busy={busy} onToggleArchive={(h) => void toggleArchive(h)} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface-raised p-6">
        <h2 className="text-section-title">Account</h2>
        <p className="mt-1 text-caption text-fg-muted">Signed in as {session?.user.email ?? 'unknown'}</p>
        {signOutError && (
          <p role="alert" className="mt-4 rounded-button bg-danger/10 px-3 py-2 text-caption text-danger">
            {signOutError}
          </p>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="mt-4 h-11 rounded-button border border-danger px-4 text-body font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:opacity-60"
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </section>
  )
}