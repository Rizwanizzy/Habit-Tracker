import type { SupabaseClient } from '@supabase/supabase-js'
import { isCompleteOtp } from './authEmail'

/** Password recovery actions. Supabase Auth owns code generation, delivery,
 *  validation and the password policy — these wrappers only shape the calls
 *  and require real results (session/user) before reporting success. */

export type RecoveryResult = { ok: true } | { ok: false; error: unknown }

/** Request a 6-digit recovery code. Deliberately takes no redirectTo: the
 *  flow verifies in-app via verifyOtp('recovery'), never a link. Supabase
 *  replies success even for unknown emails (no account enumeration). */
export async function requestRecoveryOtp(
  client: SupabaseClient,
  email: string,
): Promise<RecoveryResult> {
  const { error } = await client.auth.resetPasswordForEmail(email)
  if (error) return { ok: false, error }
  return { ok: true }
}

/** Recovery resend = the same recovery request (Supabase's `resend()` does
 *  not support recovery — never call it with type 'signup' here). */
export async function resendRecoveryOtp(
  client: SupabaseClient,
  email: string,
): Promise<RecoveryResult> {
  return requestRecoveryOtp(client, email)
}

/** Verify a recovery OTP. On success Supabase establishes a recovery
 *  session; require a real access token before the UI advances. */
export async function verifyRecoveryOtp(
  client: SupabaseClient,
  email: string,
  token: string,
): Promise<RecoveryResult> {
  if (!isCompleteOtp(token)) {
    const error = new Error('Enter the full 6-digit code.')
    Object.assign(error, { code: 'validation_failed', status: 400 })
    return { ok: false, error }
  }

  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'recovery',
  })
  if (error) return { ok: false, error }
  if (!data.session?.access_token) {
    const noSession = new Error('Verification did not establish a recovery session.')
    Object.assign(noSession, { code: 'session_not_found', status: 400 })
    return { ok: false, error: noSession }
  }
  return { ok: true }
}

/** Update the password on the recovery-authenticated session. The password
 *  travels only to Supabase Auth — never to custom endpoints or storage. */
export async function updateUserPassword(
  client: SupabaseClient,
  newPassword: string,
): Promise<RecoveryResult> {
  const { data, error } = await client.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error }
  if (!data.user) {
    const noUser = new Error('The password could not be updated.')
    Object.assign(noUser, { code: 'session_not_found', status: 400 })
    return { ok: false, error: noUser }
  }
  return { ok: true }
}

/** Best-effort sign-out of the recovery session after a successful reset.
 *  The UI ignores failures — the user is still shown the success screen. */
export async function signOutRecoverySession(client: SupabaseClient): Promise<RecoveryResult> {
  const { error } = await client.auth.signOut()
  if (error) return { ok: false, error }
  return { ok: true }
}

/** Minimal client-side pair validation: required + matching. The configured
 *  Supabase password policy is the single strength authority — no invented
 *  (weaker or stricter) rules here; the server rejects and the UI maps it. */
export function validatePasswordPair(
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!newPassword) return 'Enter a new password.'
  if (newPassword !== confirmPassword) return 'Passwords don’t match.'
  return null
}
