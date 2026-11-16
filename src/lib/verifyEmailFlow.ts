/** Session-only recovery state for the email OTP flow. Stores only the email
 *  and a non-sensitive resend-cooldown timestamp — never passwords or codes. */

import { isValidEmail, normalizeEmail } from './authEmail'

const STORAGE_KEY = 'ht.verify-email-flow'
export const RESEND_COOLDOWN_MS = 60_000

export interface VerifyEmailFlow {
  email: string
  /** Earliest Date.now() at which a resend is allowed client-side (0 = now). */
  resendAfter: number
}

interface StoredVerifyEmailFlow {
  email?: unknown
  resendAfter?: unknown
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function flowFromParsed(parsed: StoredVerifyEmailFlow, now: number): VerifyEmailFlow | null {
  const email = typeof parsed.email === 'string' ? normalizeEmail(parsed.email) : ''
  const resendAfter =
    typeof parsed.resendAfter === 'number' && Number.isFinite(parsed.resendAfter)
      ? parsed.resendAfter
      : 0
  if (!isValidEmail(email)) return null
  return { email, resendAfter: resendAfter > now ? resendAfter : 0 }
}

/** Read + validate the flow; expired cooldowns collapse to 0. */
export function readVerifyEmailFlow(now = Date.now()): VerifyEmailFlow | null {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return flowFromParsed(JSON.parse(raw) as StoredVerifyEmailFlow, now)
  } catch {
    return null
  }
}

/** Save/overwrite the flow after a successful signup or recovery email entry. */
export function saveVerifyEmailFlow(flow: VerifyEmailFlow): void {
  if (!isValidEmail(flow.email)) return
  const resendAfter = Number.isFinite(flow.resendAfter) ? flow.resendAfter : 0
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify({ email: normalizeEmail(flow.email), resendAfter }))
  } catch {
    // Private/disabled storage: the flow still works through navigation state.
  }
}

/** Clear after verification, a manual "change email", or sign-out-style exits. */
export function clearVerifyEmailFlow(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // Storage is unavailable; no cleanup is possible or necessary.
  }
}

/** A 60-second minimum cooldown; the server may still be stricter. */
export function startResendCooldown(now = Date.now()): number {
  return now + RESEND_COOLDOWN_MS
}
