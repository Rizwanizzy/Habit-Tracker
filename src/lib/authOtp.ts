import type { SupabaseClient } from '@supabase/supabase-js'
import { isCompleteOtp } from './authEmail'

/** Supabase Auth stays responsible for issuing, sending and validating OTPs.
 *  These wrappers only shape the client calls and the UI destination. */

export type AuthDestination =
  | { kind: 'app' }
  | { kind: 'verify-email'; email: string }

export type AuthFlowResult =
  | { ok: true; destination: AuthDestination }
  | { ok: true }
  | { ok: false; error: unknown }

/** One in-flight promise at a time. The UI also disables controls, but this
 *  guard protects against double events and rapid re-entry while disabled. */
export function createSingleFlight(): <T>(run: () => Promise<T>) => Promise<T | null> {
  let active = false
  return async <T,>(run: () => Promise<T>): Promise<T | null> => {
    if (active) return null
    active = true
    try {
      return await run()
    } finally {
      active = false
    }
  }
}

/** Duplicate-signup guard: Supabase can return a fake user object when email
 *  confirmation is enabled, instead of an explicit "already registered" error. */
function duplicateEmailError(): Error {
  const error = new Error('This email address is already registered.')
  Object.assign(error, { code: 'email_exists', status: 422 })
  return error
}

/** Signup: session => authenticated flow; user-only => 6-digit email OTP. */
export async function startEmailSignup(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthFlowResult> {
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) return { ok: false, error }
  if (data.session) return { ok: true, destination: { kind: 'app' } }
  if (data.user && (data.user.identities == null || data.user.identities.length === 0)) {
    return { ok: false, error: duplicateEmailError() }
  }
  if (!data.user) {
    const error = new Error('Sign-up could not be completed.')
    Object.assign(error, { code: 'unexpected_failure', status: 500 })
    return { ok: false, error }
  }
  return { ok: true, destination: { kind: 'verify-email', email } }
}

/** Existing email/password sign-in (regression-safe wrapper). */
export async function startEmailSignin(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthFlowResult> {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error }
  return { ok: true, destination: { kind: 'app' } }
}

/** Google OAuth (regression-safe wrapper): the browser leaves the page. */
export async function startGoogleSignin(
  client: SupabaseClient,
  redirectTo: string,
): Promise<AuthFlowResult> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) return { ok: false, error }
  return { ok: true, destination: { kind: 'app' } }
}

/** Verify a signup OTP. Supabase persists the session itself; require a real
 *  access token before the UI calls the result successful. */
export async function verifySignupOtp(
  client: SupabaseClient,
  email: string,
  token: string,
): Promise<AuthFlowResult> {
  if (!isCompleteOtp(token)) {
    const error = new Error('Enter the full 6-digit code.')
    Object.assign(error, { code: 'validation_failed', status: 400 })
    return { ok: false, error }
  }

  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) return { ok: false, error }
  if (!data.session?.access_token) {
    const noSession = new Error('Verification did not sign you in.')
    Object.assign(noSession, { code: 'session_not_found', status: 400 })
    return { ok: false, error: noSession }
  }
  return { ok: true }
}

/** Resend the signup confirmation code (never returns a session). */
export async function resendSignupOtp(
  client: SupabaseClient,
  email: string,
): Promise<AuthFlowResult> {
  const { error } = await client.auth.resend({ type: 'signup', email })
  if (error) return { ok: false, error }
  return { ok: true }
}
