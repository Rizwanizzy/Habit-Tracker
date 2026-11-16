import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isValidEmail, normalizeEmail } from '../lib/authEmail'
import { AuthErrorNotice } from './AuthErrorNotice'

/** Recovery UI when `/verify-email` is opened without a pending flow
 *  (direct visit, cleared storage, or a stale browser session). */
export function VerifyEmailRecovery({ onUseEmail }: { onUseEmail: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = normalizeEmail(email)
    if (!isValidEmail(next)) {
      setError('Enter the email address you used to create your account.')
      return
    }
    setError(null)
    onUseEmail(next)
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="mt-1 text-body text-fg-muted">
        Enter the email you used to create your account. You can then paste the code from your
        verification email, or request a new one.
      </p>

      <label htmlFor="recovery-email" className="mt-5 block text-caption text-fg-muted">
        Email
      </label>
      <input
        id="recovery-email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input-field mt-2 h-12"
        placeholder="you@example.com"
      />

      {error && <AuthErrorNotice message={error} />}

      <button
        type="submit"
        className="bg-accent-gradient glow-accent mt-6 h-12 w-full rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110"
      >
        Continue
      </button>
      <Link
        to="/login"
        replace
        className="glass-pill mt-3 flex h-12 w-full items-center justify-center rounded-pill text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised"
      >
        Back to sign in
      </Link>
    </form>
  )
}
