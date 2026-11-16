/** Session-only state for the password-recovery flow. Stores only the email,
 *  a non-sensitive resend-cooldown timestamp and a boolean "code verified"
 *  flag — never passwords or OTP codes. */

import { isValidEmail, normalizeEmail } from './authEmail'
import { RESEND_COOLDOWN_MS, startResendCooldown } from './verifyEmailFlow'

const STORAGE_KEY = 'ht.recovery-flow'

export interface RecoveryFlowState {
  email: string
  /** Earliest Date.now() at which a resend is allowed client-side (0 = now). */
  resendAfter: number
  /** True once the recovery code verified (recovery session is established). */
  verified: boolean
}

interface StoredRecoveryFlow {
  email?: unknown
  resendAfter?: unknown
  verified?: unknown
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function flowFromParsed(parsed: StoredRecoveryFlow, now: number): RecoveryFlowState | null {
  const email = typeof parsed.email === 'string' ? normalizeEmail(parsed.email) : ''
  const resendAfter =
    typeof parsed.resendAfter === 'number' && Number.isFinite(parsed.resendAfter)
      ? parsed.resendAfter
      : 0
  if (!isValidEmail(email)) return null
  return {
    email,
    resendAfter: resendAfter > now ? resendAfter : 0,
    verified: parsed.verified === true,
  }
}

/** Read + validate the flow; expired cooldowns collapse to 0. */
export function readRecoveryFlow(now = Date.now()): RecoveryFlowState | null {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return flowFromParsed(JSON.parse(raw) as StoredRecoveryFlow, now)
  } catch {
    return null
  }
}

/** Save/overwrite the flow at each step of the recovery journey. */
export function saveRecoveryFlow(flow: RecoveryFlowState): void {
  if (!isValidEmail(flow.email)) return
  const resendAfter = Number.isFinite(flow.resendAfter) ? flow.resendAfter : 0
  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email: normalizeEmail(flow.email),
        resendAfter,
        verified: flow.verified === true,
      }),
    )
  } catch {
    // Private/disabled storage: the flow still works through navigation state.
  }
}

/** Clear after a successful reset, "use a different email", or completion. */
export function clearRecoveryFlow(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // Storage is unavailable; no cleanup is possible or necessary.
  }
}

export { RESEND_COOLDOWN_MS, startResendCooldown }
