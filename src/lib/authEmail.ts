/** Pure email/OTP helpers shared by the Login and VerifyEmail flows. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OTP_LENGTH = 6

/** Trim + lowercase the address before it is handed to Supabase. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Conservative client-side email check (Supabase performs the real check). */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(normalizeEmail(value))
}

/** Keep only the first `maxLength` ASCII digits; rejects every other character. */
export function sanitizeOtp(value: string, maxLength = OTP_LENGTH): string {
  const digits = value.replace(/\D/g, '')
  return digits.slice(0, maxLength)
}

/** A 6-character digit string: leading zeros are preserved. */
export function isCompleteOtp(value: string, length = OTP_LENGTH): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value)
}

/** Fixed slot presentation for the OTP component (empty slot = ''). */
export function otpSlots(value: string, length = OTP_LENGTH): string[] {
  return Array.from({ length }, (_, i) => value[i] ?? '')
}

/** Read a plain string email out of React Router location state safely. */
export function emailFromLocationState(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('email' in state)) return null
  const email = (state as { email?: unknown }).email
  if (typeof email !== 'string') return null
  const normalized = normalizeEmail(email)
  return isValidEmail(normalized) ? normalized : null
}
