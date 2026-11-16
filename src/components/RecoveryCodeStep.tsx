import { useEffect, useRef, useState } from 'react'
import { OtpInput } from './OtpInput'
import { AuthErrorNotice } from './AuthErrorNotice'
import { getSupabase } from '../lib/supabase'
import { isCompleteOtp } from '../lib/authEmail'
import { authErrorKind, authErrorMessage, offlineAuthMessage } from '../lib/authErrors'
import { requestRecoveryOtp, verifyRecoveryOtp } from '../lib/authRecovery'
import { createSingleFlight } from '../lib/authOtp'
import { startResendCooldown } from '../lib/recoveryFlow'

interface Props {
  email: string
  /** Cooldown timestamp restored from flow state after a reload (0 = now). */
  initialResendAfter: number
  /** Persist the cooldown timestamp into the page's flow state. */
  onCooldownStart: (resendAfter: number) => void
  /** Called after the code verified and a real recovery session exists. */
  onVerified: () => void
  onUseDifferentEmail: () => void
}

/** Recovery step 2: enter + verify the 6-digit code, with resend cooldown.
 *  Owns only non-sensitive state (code, countdown, status) — nothing is
 *  persisted beyond the page's flow state. */
export function RecoveryCodeStep({
  email,
  initialResendAfter,
  onCooldownStart,
  onVerified,
  onUseDifferentEmail,
}: Props) {
  const mountedRef = useRef(true)
  const verifyFlight = useRef(createSingleFlight())
  const resendFlight = useRef(createSingleFlight())
  const otpRef = useRef<HTMLInputElement>(null)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [cooldownEndsAt, setCooldownEndsAt] = useState(initialResendAfter)
  const [cooldownLeft, setCooldownLeft] = useState(() =>
    cooldownEndsAt ? Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000)) : 0,
  )
  const [status, setStatus] = useState<string | null>(
    'If an account exists for this email, a 6-digit recovery code is on its way.',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Countdown driven by the absolute cooldown timestamp, so backgrounding the
  // PWA or reloading the page does not make the countdown drift or restart.
  useEffect(() => {
    if (!cooldownEndsAt) return
    const tick = () =>
      setCooldownLeft(Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [cooldownEndsAt])

  async function verify() {
    if (verifying || resendBusy || !isCompleteOtp(code)) return
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      setError(offlineAuthMessage())
      return
    }
    setError(null)
    setVerifying(true)
    try {
      const result = await verifyFlight.current(() => verifyRecoveryOtp(getSupabase(), email, code))
      if (!result || !mountedRef.current) return
      if (!result.ok) {
        setError(authErrorMessage(result.error, 'recovery-verify'))
        if (['invalid', 'expired'].includes(authErrorKind(result.error))) {
          setCode('')
          otpRef.current?.focus()
        }
        return
      }
      onVerified()
    } catch (err) {
      if (mountedRef.current) setError(authErrorMessage(err, 'recovery-verify'))
    } finally {
      if (mountedRef.current) setVerifying(false)
    }
  }

  async function resend() {
    if (resendBusy || verifying || cooldownLeft > 0) return
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      setError(offlineAuthMessage())
      return
    }
    setError(null)
    setStatus(null)
    setResendBusy(true)
    try {
      const result = await resendFlight.current(() => requestRecoveryOtp(getSupabase(), email))
      if (!result || !mountedRef.current) return
      const armCooldown = (withStatus: boolean) => {
        const after = startResendCooldown()
        setCooldownEndsAt(after)
        setCooldownLeft(60)
        onCooldownStart(after)
        if (withStatus) {
          setStatus('A new recovery code was sent to ' + email + ' if the account exists.')
        }
      }
      if (!result.ok) {
        setError(authErrorMessage(result.error, 'recovery-resend'))
        // A rate-limited request still consumed the send window.
        if (authErrorKind(result.error) === 'rate_limit') armCooldown(false)
        return
      }
      armCooldown(true)
    } catch (err) {
      if (mountedRef.current) setError(authErrorMessage(err, 'recovery-resend'))
    } finally {
      if (mountedRef.current) setResendBusy(false)
    }
  }

  const ready = isCompleteOtp(code) && !verifying && !resendBusy

  return (
    <>
      <div className="mt-5">
        <OtpInput ref={otpRef} value={code} onChange={setCode} disabled={verifying} autoFocus />
      </div>
      <p aria-live="polite" className="sr-only">
        {ready ? 'Recovery code complete. Choose Verify.' : ''}
      </p>
      <button
        type="button"
        onClick={() => void verify()}
        disabled={!ready}
        className="bg-accent-gradient glow-accent mt-6 h-12 w-full rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:opacity-60"
      >
        {verifying ? 'Verifying…' : 'Verify code'}
      </button>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={resendBusy || verifying || cooldownLeft > 0}
        className="glass-pill mt-3 h-12 w-full rounded-pill text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised disabled:opacity-60"
      >
        {resendBusy
          ? 'Resending…'
          : cooldownLeft > 0
            ? 'Resend available in ' + cooldownLeft + 's'
            : 'Resend code'}
      </button>
      <p className="mt-4 text-caption text-fg-muted">
        Enter the 6-digit code from your recovery email. Codes expire after 60 minutes.
        If you don’t see it, check spam.
      </p>
      {status && (
        <p role="status" className="mt-4 rounded-input bg-success/10 px-3 py-2 text-body text-success">
          {status}
        </p>
      )}
      {error && <AuthErrorNotice message={error} />}
      <button
        type="button"
        onClick={onUseDifferentEmail}
        disabled={verifying || resendBusy}
        className="glass-pill mt-5 flex h-11 w-full items-center justify-center rounded-pill text-caption font-medium text-fg transition-colors duration-150 hover:bg-surface-raised disabled:opacity-60"
      >
        Use a different email
      </button>
    </>
  )
}
