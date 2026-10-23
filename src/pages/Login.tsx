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

  const inputClass =
    'mt-2 h-11 w-full rounded-button border border-border bg-surface px-3 text-body text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none'

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 text-fg">
      <form
        onSubmit={signIn}
        className="w-full max-w-sm rounded-card border border-border bg-surface-raised p-6"
      >
        <h1 className="text-page-title">Sign in</h1>
        <p className="mt-1 text-caption text-fg-muted">
          Sign in to sync your habits across devices.
        </p>

        <label htmlFor="email" className="mt-6 block font-medium text-fg-secondary text-body">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />

        <label htmlFor="password" className="mt-4 block font-medium text-fg-secondary text-body">
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
          className={inputClass}
          placeholder="At least 6 characters"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-button bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 rounded-button bg-success/10 px-3 py-2 text-caption text-success">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-11 w-full rounded-button bg-accent text-white text-body font-semibold transition-colors duration-150 hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={signUp}
          disabled={busy}
          className="mt-3 h-11 w-full rounded-button border border-border text-body font-medium text-fg transition-colors duration-150 hover:bg-surface disabled:opacity-60"
        >
          Create account
        </button>
      </form>
    </div>
  )
}