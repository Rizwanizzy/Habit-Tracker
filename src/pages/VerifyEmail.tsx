import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { OtpInput } from '../components/OtpInput'
import { AuthErrorNotice } from '../components/AuthErrorNotice'
import { VerifyEmailRecovery } from '../components/VerifyEmailRecovery'
import { getSupabase } from '../lib/supabase'
import { emailFromLocationState, isCompleteOtp } from '../lib/authEmail'
import { authErrorKind, authErrorMessage, offlineAuthMessage } from '../lib/authErrors'
import { resendSignupOtp, verifySignupOtp, createSingleFlight } from '../lib/authOtp'
import {
  clearVerifyEmailFlow,
  readVerifyEmailFlow,
  saveVerifyEmailFlow,
  startResendCooldown,
  type VerifyEmailFlow,
} from '../lib/verifyEmailFlow'

/** Must match the Supabase Auth "Email OTP expiry" setting documented in
 *  supabase/email-templates. Current staging value: 3600 seconds. */
const OTP_EXPIRY_MINUTES = 60

/** Email OTP verification page for a signup that did not auto-confirm. */
export function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const mountedRef = useRef(true)
  const redirectingRef = useRef(false)
  const otpRef = useRef<HTMLInputElement>(null)
  const verifyFlight = useRef(createSingleFlight())
  const resendFlight = useRef(createSingleFlight())

  const [flow, setFlow] = useState<VerifyEmailFlow | null>(() => {
    const stateEmail = emailFromLocationState(location.state)
    if (stateEmail) {
      const stored = readVerifyEmailFlow()
      return {
        email: stateEmail,
        resendAfter: stored?.email === stateEmail ? stored.resendAfter : 0,
      }
    }
    return readVerifyEmailFlow()
  })
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [cooldownLeft, setCooldownLeft] = useState(() =>
    flow?.resendAfter ? Math.max(0, Math.ceil((flow.resendAfter - Date.now()) / 1000)) : 0,
  )
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Persist the email (and cooldown) so a PWA refresh can resume the flow.
  useEffect(() => {
    if (flow) saveVerifyEmailFlow(flow)
  }, [flow])

  // Session-only page: an already-authenticated visitor goes into the app.
  useEffect(() => {
    mountedRef.current = true
    let sb: ReturnType<typeof getSupabase>
    try {
      sb = getSupabase()
    } catch {
      const configError = new Error('Email provider is not configured.')
      Object.assign(configError, { code: 'email_provider_disabled', status: 503 })
      setError(authErrorMessage(configError, 'verify'))
      return
    }

    const redirectToApp = () => {
      if (!mountedRef.current || redirectingRef.current) return
      redirectingRef.current = true
      navigate('/', { replace: true })
    }

    let active = true
    sb.auth.getSession()
      .then(({ data }) => {
        if (active && data.session) redirectToApp()
      })
      .catch(() => undefined)
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) redirectToApp()
    })
    return () => {
      active = false
      mountedRef.current = false
      data.subscription.unsubscribe()
    }
  }, [navigate])

  // Countdown driven by the absolute cooldown timestamp, so backgrounding the
  // PWA or reloading the page does not make the countdown drift or restart.
  const resendAfter = flow?.resendAfter ?? 0
  useEffect(() => {
    if (!resendAfter) {
      setCooldownLeft(0)
      return
    }
    const tick = () =>
      setCooldownLeft(Math.max(0, Math.ceil((resendAfter - Date.now()) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [resendAfter])

  function useRecoveredEmail(email: string) {
    const next: VerifyEmailFlow = { email, resendAfter: 0 }
    setFlow(next)
    setCode('')
    setStatus(null)
    setError(null)
  }

  function changeEmail() {
    clearVerifyEmailFlow()
    navigate('/login', { replace: true })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (verifying || resendBusy || !flow || !isCompleteOtp(code)) return
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      setError(offlineAuthMessage())
      return
    }

    setError(null)
    setVerifying(true)
    try {
      const result = await verifyFlight.current(() => verifySignupOtp(getSupabase(), flow.email, code))
      if (!result || !mountedRef.current) return
      if (!result.ok) {
        setError(authErrorMessage(result.error, 'verify'))
        if (['invalid', 'expired'].includes(authErrorKind(result.error))) {
          setCode('')
          otpRef.current?.focus()
        }
        return
      }
      clearVerifyEmailFlow()
      navigate('/', { replace: true })
    } catch (err) {
      if (mountedRef.current) setError(authErrorMessage(err, 'verify'))
    } finally {
      if (mountedRef.current) setVerifying(false)
    }
  }

  async function resend() {
    if (resendBusy || verifying || !flow || cooldownLeft > 0) return
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      setError(offlineAuthMessage())
      return
    }

    setError(null)
    setStatus(null)
    setResendBusy(true)
    try {
      const result = await resendFlight.current(() => resendSignupOtp(getSupabase(), flow.email))
      if (!result || !mountedRef.current) return
      if (!result.ok) {
        setError(authErrorMessage(result.error, 'resend'))
        if (authErrorKind(result.error) === 'rate_limit') {
          const next = { ...flow, resendAfter: startResendCooldown() }
          setFlow(next)
        }
        return
      }
      const next = { ...flow, resendAfter: startResendCooldown() }
      setFlow(next)
      setStatus(`A new verification code was sent to ${flow.email}.`)
    } catch (err) {
      if (mountedRef.current) setError(authErrorMessage(err, 'resend'))
    } finally {
      if (mountedRef.current) setResendBusy(false)
    }
  }

  if (!flow) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 py-10">
        <div className="glass-card fade-up w-full max-w-sm rounded-card p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <img src="/logo.png" alt="Habit Tracker" className="mb-3 size-[72px]" aria-hidden="true" />
            <h1 className="text-page-title mt-2">Verify your email</h1>
          </div>
          <VerifyEmailRecovery onUseEmail={useRecoveredEmail} />
        </div>
      </div>
    )
  }

  const ready = isCompleteOtp(code) && !verifying && !resendBusy

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <main
        aria-busy={verifying || resendBusy}
        className="glass-card fade-up w-full max-w-sm rounded-card p-5 sm:p-7"
      >
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Habit Tracker" className="mb-3 size-[72px]" aria-hidden="true" />
          <h1 className="text-page-title mt-1">Verify your email</h1>
          <p className="mt-1 w-full break-all rounded-input bg-surface-2/50 px-3 py-2 text-body text-fg">
            {flow.email}
          </p>
        </div>

        <form onSubmit={submit} className="mt-5" noValidate>
          <label htmlFor="otp-code" className="block text-caption text-fg-muted">
            Verification code
          </label>
          <div className="mt-2">
            <OtpInput
              ref={otpRef}
              value={code}
              onChange={setCode}
              disabled={verifying}
              autoFocus
            />
          </div>

          <p aria-live="polite" className="sr-only">
            {ready ? 'Verification code complete. Choose Verify.' : ''}
          </p>

          <button
            type="submit"
            disabled={!ready}
            className="bg-accent-gradient glow-accent mt-6 h-12 w-full rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify email'}
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
                ? `Resend available in ${cooldownLeft}s`
                : 'Resend code'}
          </button>
        </form>

        <p id="otp-help" className="mt-4 text-caption text-fg-muted">
          Enter the 6-digit code from your email. Codes expire after {OTP_EXPIRY_MINUTES} minutes.
          If you don’t see it, check spam.
        </p>

        {status && (
          <p role="status" className="mt-4 rounded-input bg-success/10 px-3 py-2 text-body text-success">
            {status}
          </p>
        )}
        {error && <AuthErrorNotice message={error} />}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={changeEmail}
            disabled={verifying || resendBusy}
            className="glass-pill flex h-11 items-center justify-center rounded-pill text-caption font-medium text-fg transition-colors duration-150 hover:bg-surface-raised disabled:opacity-60"
          >
            Change email
          </button>
          <Link
            to="/login"
            replace
            className="glass-pill flex h-11 items-center justify-center rounded-pill text-caption font-medium text-fg transition-colors duration-150 hover:bg-surface-raised"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    </div>
  )
}
