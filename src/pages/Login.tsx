import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)

  // The Google OAuth flow leaves the page and comes back to /login?code=…
  // The Supabase client exchanges that code for a session on load
  // (detectSessionInUrl), so subscribe here and go straight into the app
  // the moment the signed-in session lands on this page.
  useEffect(() => {
    let sb: ReturnType<typeof getSupabase>
    try {
      sb = getSupabase()
    } catch {
      setChecking(false)
      return
    }

    // Check immediately: if a session already exists (e.g. page refresh while
    // signed in), go straight to the app without showing the login form.
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/', { replace: true })
      }
      setChecking(false)
    })

    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/', { replace: true })
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  if (checking) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-fg-muted">
        <div className="flex flex-col items-center gap-4">
          <div
            className="size-16 rounded-full border-6 border-fg/10 border-t-accent animate-spin"
            role="status"
            aria-label="Loading"
          />
          <span className="text-page-title text-fg">Signing you in…</span>
        </div>
      </div>
    )
  }

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

  /** Google OAuth: leaves the page for Google's consent screen, then comes
   *  back to /login where the effect above picks up the session. Errors
   *  (e.g. the provider not being enabled yet on the Supabase project) are
   *  shown inline, never swallowed. */
  async function signInWithGoogle() {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login` },
      })
      if (error) throw error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setBusy(false)
    }
    // No finally: on success the browser navigates away to Google.
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
        {/* Logo mark above the card content (DESIGN.md §8). */}
        <div className="flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Habit Tracker"
            className="size-[84px] mb-3"
            aria-hidden="true"
          />
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
        <p aria-hidden="true" className="text-caption mt-5 text-center text-fg-muted">
          or
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-pill bg-[#4285F4] text-body font-medium text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:opacity-60"
        >
          {/* Google "G" mark (standard multicolor SVG, 48px grid) in a white
              chip — the OAuth-provider brand pill, styled per user request. */}
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-white">
            <svg viewBox="0 0 48 48" className="size-4">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.971 3.029l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.382-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.019C14.665 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.971 3.029l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.057 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.382-3.917z" />
            </svg>
          </span>
          Sign in with Google
        </button>
      </form>
    </div>
  )
}
