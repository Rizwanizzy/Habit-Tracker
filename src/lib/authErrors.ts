/** Turn Supabase Auth errors into short, actionable UI messages.
 *  Supabase still owns the truth; this only keeps user-facing copy stable. */

export type AuthContext = 'signup' | 'signin' | 'verify' | 'resend' | 'google'
export type AuthErrorKind =
  | 'duplicate_email'
  | 'rate_limit'
  | 'expired'
  | 'invalid'
  | 'network'
  | 'server'
  | 'configuration'
  | 'unknown'

interface AuthErrorLike {
  message?: unknown
  status?: unknown
  code?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function authParts(error: unknown): { message: string; status: number; code: string } {
  const like = error as AuthErrorLike | null
  return {
    message: text(like?.message),
    status: typeof like?.status === 'number' ? like.status : 0,
    code: text(like?.code),
  }
}

/** Machine-readable classification for tests and UI decisions. */
export function authErrorKind(error: unknown): AuthErrorKind {
  if (error instanceof TypeError) return 'network'
  const { message, status, code } = authParts(error)

  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_sms_send_rate_limit' ||
    status === 429 ||
    message.includes('rate limit')
  ) {
    return 'rate_limit'
  }
  if (code === 'otp_expired' || code === 'session_expired' || message.includes('expired')) {
    return 'expired'
  }
  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    message.includes('user already registered') ||
    message.includes('email address is already registered')
  ) {
    return 'duplicate_email'
  }
  if (code === 'otp_disabled' || code === 'email_provider_disabled' || code === 'email_address_not_authorized') {
    return 'configuration'
  }
  if (
    code === 'invalid_credentials' ||
    code === 'email_not_confirmed' ||
    message.includes('invalid') ||
    message.includes('not confirmed')
  ) {
    return 'invalid'
  }
  if (status >= 500 || code === 'unexpected_failure') return 'server'
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('fetch failed') ||
    message.includes('load failed')
  ) {
    return 'network'
  }
  return 'unknown'
}

/** Short user-facing copy. Always actionable; never exposes internals. */
export function authErrorMessage(error: unknown, context: AuthContext): string {
  const kind = authErrorKind(error)

  if (kind === 'duplicate_email' && context === 'signup') {
    return 'An account with this email already exists. Sign in instead, or use a different email.'
  }
  if (kind === 'rate_limit') {
    return context === 'resend'
      ? 'Too many code requests. Wait a minute, then try Resend again.'
      : 'Too many attempts. Wait a minute, then try again.'
  }
  if (kind === 'expired') {
    return 'This code has expired. Request a new code and try again.'
  }
  if (kind === 'invalid') {
    return context === 'verify'
      ? 'That code is incorrect. Check the latest email and try again.'
      : 'Check your details and try again.'
  }
  if (kind === 'network') {
    return 'Habit Tracker could not reach the service. Check your connection and try again.'
  }
  if (kind === 'server') {
    return 'The service is temporarily unavailable. Try again in a moment.'
  }
  if (kind === 'configuration') {
    return 'Email verification is not available right now. Try again later or contact support.'
  }
  if (context === 'signin') {
    return 'Sign in failed. Check your email and password, then try again.'
  }
  if (context === 'google') {
    return 'Google sign-in failed. Try again.'
  }
  if (context === 'signup') {
    return 'Sign up failed. Try again.'
  }
  return 'Verification failed. Try again.'
}

/** Special offline copy for the VerifyEmail page. */
export function offlineAuthMessage(): string {
  return 'You appear to be offline. Reconnect, then try again.'
}
