import { useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'

export function Settings() {
  const { session } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setError(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const { error } = await sb.auth.signOut()
      if (error) throw error
      // RequireAuth listens to onAuthStateChange and redirects to /login.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1 className="text-page-title">Settings</h1>

      <div className="mt-6 rounded-card border border-border bg-surface-raised p-6">
        <h2 className="text-section-title">Appearance</h2>
        <p className="mt-1 text-caption text-fg-muted">
          Switch between light and dark themes.
        </p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface-raised p-6">
        <h2 className="text-section-title">Account</h2>
        <p className="mt-1 text-caption text-fg-muted">
          Signed in as {session?.user.email ?? 'unknown'}
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-button bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="mt-4 h-11 rounded-button border border-danger px-4 text-body font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:opacity-60"
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </section>
  )
}