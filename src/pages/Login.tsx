import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  async function signUp() {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const { data, error } = await sb.auth.signUp({ email, password })
      if (error) throw error
      if (data.session) {
        navigate('/', { replace: true })
      } else {
        setMessage('Account created. Check your email to confirm, then sign in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <form
        onSubmit={signIn}
        className="glass-card fade-up w-full max-w-sm rounded-card p-6 sm:p-8"
      >
        {/* Gradient logo mark above the card content (DESIGN.md §8). */}
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="bg-accent-gradient glow-accent grid size-16 place-items-center rounded-[20px]"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-8"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <path d="m8 12.5 2.5 2.5L16 9.5" />
            </svg>
          </span>
          <h1 className="text-page-title mt-4">Sign in</h1>
          <p className="text-caption mt-1 text-fg-muted">Sync your habits across devices</p>
        </div>

        <label htmlFor="email" className="text-caption mt-6 block text-fg-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field mt-2"
          placeholder="you@example.com"
        />

        <label htmlFor="password" className="text-caption mt-4 block text-fg-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field mt-2"
          placeholder="At least 6 characters"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-body text-danger">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 rounded-input bg-success/10 px-3 py-2 text-body text-success">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="bg-accent-gradient glow-accent mt-6 h-12 w-full rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={signUp}
          disabled={busy}
          className="glass-pill mt-3 h-12 w-full rounded-pill text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised disabled:opacity-60"
        >
          Create account
        </button>
      </form>
    </div>
  )
}
