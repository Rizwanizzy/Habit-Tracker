import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { RecoveryCodeStep } from '../components/RecoveryCodeStep'
import { RecoverySuccessCard } from '../components/RecoverySuccessCard'
import { NewPasswordForm } from '../components/NewPasswordForm'
import { getSupabase } from '../lib/supabase'
import { emailFromLocationState } from '../lib/authEmail'
import { authErrorMessage, offlineAuthMessage } from '../lib/authErrors'
import { signOutRecoverySession, updateUserPassword } from '../lib/authRecovery'
import { createSingleFlight } from '../lib/authOtp'
import {
  clearRecoveryFlow,
  readRecoveryFlow,
  saveRecoveryFlow,
  type RecoveryFlowState,
} from '../lib/recoveryFlow'

/** Steps 2–4 of password recovery: verify the 6-digit code (RecoveryCodeStep),
 *  set the new password on the recovery session, then sign out and confirm.
 *  NOTE: no authenticated-session redirect — the recovery session must stay
 *  on this page until the password is updated (then it is signed out). */
export function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const mountedRef = useRef(true)
  const updateFlight = useRef(createSingleFlight())

  const [flow, setFlow] = useState<RecoveryFlowState | null>(() => {
    const stateEmail = emailFromLocationState(location.state)
    if (stateEmail) {
      const stored = readRecoveryFlow()
      return {
        email: stateEmail,
        resendAfter: stored?.email === stateEmail ? stored.resendAfter : 0,
        verified: false,
      }
    }
    return readRecoveryFlow()
  })
  const [step, setStep] = useState<'password' | 'success'>('password')
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (flow) saveRecoveryFlow(flow)
  }, [flow])

  if (!flow) return <Navigate to="/forgot-password" replace />

  function useDifferentEmail() {
    clearRecoveryFlow()
    navigate('/forgot-password', { replace: true })
  }

  async function updatePassword(newPassword: string) {
    if (!flow) return
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      setError(offlineAuthMessage())
      return
    }
    setError(null)
    setUpdating(true)
    try {
      const result = await updateFlight.current(() => updateUserPassword(getSupabase(), newPassword))
      if (!result || !mountedRef.current) return
      if (!result.ok) {
        setError(authErrorMessage(result.error, 'password-update'))
        return
      }
      // Policy: end recovery signed out. Other devices are NOT revoked by
      // updateUser — no claim about them is made anywhere in the UI.
      await signOutRecoverySession(getSupabase()).catch(() => undefined)
      clearRecoveryFlow()
      setStep('success')
    } catch (err) {
      if (mountedRef.current) setError(authErrorMessage(err, 'password-update'))
    } finally {
      if (mountedRef.current) setUpdating(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="grid min-h-dvh place-items-center px-4 py-10">
        <RecoverySuccessCard />
      </div>
    )
  }

  // A dead recovery session (expired/missing on update) must not fake success:
  // the copy in authErrors ends with "start again", which opens the restart path.
  const sessionGone = error?.includes('recovery session has expired') ?? false

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <main aria-busy={updating} className="glass-card fade-up w-full max-w-sm rounded-card p-5 sm:p-7">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Habit Tracker" className="mb-3 size-[72px]" aria-hidden="true" />
          <h1 className="text-page-title mt-1">Reset your password</h1>
          <p className="mt-1 w-full break-all rounded-input bg-surface-2/50 px-3 py-2 text-body text-fg">
            {flow.email}
          </p>
        </div>

        {!flow.verified && (
          <RecoveryCodeStep
            email={flow.email}
            initialResendAfter={flow.resendAfter}
            onCooldownStart={(resendAfter) => setFlow({ ...flow, resendAfter })}
            onVerified={() => setFlow({ ...flow, verified: true })}
            onUseDifferentEmail={useDifferentEmail}
          />
        )}

        {flow.verified && (
          <>
            <p className="mt-4 text-body text-fg-muted">
              Code verified. Choose a new password for your account.
            </p>
            <div className="mt-4">
              <NewPasswordForm busy={updating} error={error} onSubmit={(pw) => void updatePassword(pw)} />
            </div>
            {sessionGone && (
              <button
                type="button"
                onClick={useDifferentEmail}
                className="glass-pill mt-3 flex h-12 w-full items-center justify-center rounded-pill text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised"
              >
                Restart recovery
              </button>
            )}
            <p className="mt-4 text-caption text-fg-muted">
              You’ll be signed out after the reset — sign in with your new password.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
