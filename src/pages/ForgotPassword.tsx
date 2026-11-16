import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'
import { isValidEmail, normalizeEmail } from '../lib/authEmail'
import { authErrorKind, authErrorMessage, offlineAuthMessage } from '../lib/authErrors'
import { requestRecoveryOtp } from '../lib/authRecovery'
import { createSingleFlight } from '../lib/authOtp'
import { saveRecoveryFlow, startResendCooldown } from '../lib/recoveryFlow'

/** Step 1 of password recovery: request a 6-digit code for an email.
 *  Success always shows generic wording — Supabase replies success for
 *  unknown emails too, so the UI must not reveal account existence. */
export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const flight = useRef(createSingleFlight())

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const normalized = normalizeEmail(email)
    if (!isValidEmail(normalized)) {
      setError('Enter the email address on your account.')
      return
    }
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      setError(offlineAuthMessage())
      return
    }

    setError(null)
    setBusy(true)
    try {
      const result = await flight.current(() => requestRecoveryOtp(getSupabase(), normalized))
      if (!result) return // another request owns the submission
      if (!result.ok) {
        setError(authErrorMessage(result.error, 'recovery-request'))
        // A rate-limited request still consumed the send window: arm the same
        // 60-second cooldown the verify screen uses for its resend button.
        if (authErrorKind(result.error) === 'rate_limit') {
          saveRecoveryFlow({ email: normalized, resendAfter: startResendCooldown(), verified: false })
        }
        return
      }
      saveRecoveryFlow({ email: normalized, resendAfter: 0, verified: false })
      navigate('/reset-password', { state: { email: normalized } })
    } catch (err) {
      setError(authErrorMessage(err, 'recovery-request'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <main
        aria-busy={busy}
        className="glass-card fade-up w-full max-w-sm rounded-card p-6 sm:p-8"
      >
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Habit Tracker" className="mb-3 size-[72px]" aria-hidden="true" />
          <h1 className="text-page-title mt-1">Reset your password</h1>
          <p className="text-caption mt-1 text-fg-muted">
            We'll email you a 6-digit code to set a new password.
          </p>
        </div>

        <form onSubmit={submit} noValidate>
          <label htmlFor="recovery-email" className="mt-6 block text-caption text-fg-muted">
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
            className="input-field mt-2"
            placeholder="you@example.com"
          />

          {error && (
            <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-body text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="bg-accent-gradient glow-accent mt-6 h-12 w-full rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Sending code…' : 'Send recovery code'}
          </button>
        </form>

        <Link
          to="/login"
          replace
          className="glass-pill mt-3 flex h-12 w-full items-center justify-center rounded-pill text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised"
        >
          Back to sign in
        </Link>
      </main>
    </div>
  )
}
