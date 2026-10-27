import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { extractError } from '../hooks/useHabits'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useBackup } from '../hooks/useBackup'
import { DayStartCard } from '../components/DayStartCard'
import type { Habit } from '../lib/score'

type Notice = { kind: 'success' | 'danger'; text: string } | null

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
    <li className="manage-cell relative flex min-h-[64px] items-center gap-3 rounded-input border border-border bg-surface-raised px-3 py-2">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color ?? '#3B82F6' }}
      />
      <span className="manage-name min-w-0 flex-1 truncate text-body font-medium text-fg" title={habit.name}>
        {habit.name}
      </span>
      <button
        type="button"
        onClick={() => onToggleArchive(habit)}
        disabled={busy}
        className="manage-archive relative glass-pill h-11 shrink-0 rounded-pill px-4 text-body font-medium text-fg-secondary transition-colors duration-150 hover:text-fg disabled:opacity-60"
      >
        {archived ? 'Restore' : 'Archive'}
      </button>
    </li>
  )
}

export function Settings() {
  const { habits, loading, error, reload, archiveHabit } = useHabitsContext()
  const { exportBackup, busy: backupBusy } = useBackup()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [includeProfile, setIncludeProfile] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  // Auto-dismiss toasts ("Backup downloaded" / failure), same as Profile.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function handleExport() {
    const message = await exportBackup(includeProfile)
    if (message) setNotice({ kind: 'danger', text: message })
    else setNotice({ kind: 'success', text: 'Backup downloaded' })
  }

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
        <p className="text-caption mt-1 text-fg-muted">Habits and preferences</p>
      </header>

      {/* Two columns on desktop (DESIGN.md §8): Day (day-start) + Data
          (backup) cards left, Habits right. Profile is reached via the
          Today-header avatar and the dock; the Account card was removed
          (user request) — Profile shows the signed-in email. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="grid content-start gap-4 lg:gap-5">
          <DayStartCard />

          {/* Data card: JSON backup export (DESIGN.md §8). Import is not
              supported yet — download only. */}
          <div className="glass-card fade-up rounded-card p-6" style={{ animationDelay: '40ms' }}>
            <h2 className="text-section-title">Data</h2>
            <p className="mt-1 text-body text-fg-secondary">
              Download a JSON backup of your habits and check-ins. Profile photos aren&apos;t included.
            </p>
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={includeProfile}
                onChange={(e) => setIncludeProfile(e.target.checked)}
                className="size-5 shrink-0 accent-accent"
              />
              <span className="text-body text-fg">Include profile details</span>
            </label>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={backupBusy}
              className="mt-3 inline-flex items-center justify-center gap-2.5 rounded-pill bg-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60"
              style={{ height: 44 }}
            >
              {backupBusy && (
                <span
                  aria-hidden="true"
                  className="progress-spin size-4 rounded-full border-2 border-white/40 border-t-white"
                />
              )}
              {backupBusy ? 'Backing up…' : 'Download backup'}
            </button>
          </div>
        </div>

        <div className="glass-card fade-up rounded-card p-6" style={{ animationDelay: '80ms' }}>
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
              <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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

      {/* Backup toast (Profile pattern): "Backup downloaded" or the failure. */}
      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center lg:bottom-6"
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
