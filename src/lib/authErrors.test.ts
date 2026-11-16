import { describe, expect, it } from 'vitest'
import { authErrorKind, authErrorMessage, offlineAuthMessage } from './authErrors'

function authError(message: string, status?: number, code?: string): Error {
  const error = new Error(message)
  Object.assign(error, { status, code })
  return error
}

describe('auth error mapping', () => {
  it('classifies invalid, expired, rate-limited, duplicate and offline errors', () => {
    expect(authErrorKind(authError('Invalid login credentials', 400, 'invalid_credentials'))).toBe('invalid')
    expect(authErrorKind(authError('OTP expired', 403, 'otp_expired'))).toBe('expired')
    expect(authErrorKind(authError('Too many requests', 429, 'over_email_send_rate_limit'))).toBe('rate_limit')
    expect(authErrorKind(authError('User already registered', 422, 'user_already_exists'))).toBe('duplicate_email')
    expect(authErrorKind(new TypeError('Failed to fetch'))).toBe('network')
    expect(authErrorKind(authError('Internal error', 500, 'unexpected_failure'))).toBe('server')
  })

  it('returns actionable copy for verification and resend failures', () => {
    const invalid = authError('Invalid OTP', 400, 'invalid_credentials')
    expect(authErrorMessage(invalid, 'verify')).toContain('incorrect')

    const expired = authError('Email OTP expired', 403, 'otp_expired')
    expect(authErrorMessage(expired, 'verify')).toContain('expired')

    const rateLimited = authError('Over email send rate limit', 429, 'over_email_send_rate_limit')
    expect(authErrorMessage(rateLimited, 'resend')).toContain('Wait a minute')

    const duplicate = authError('User already registered', 422, 'email_exists')
    expect(authErrorMessage(duplicate, 'signup')).toContain('already exists')
  })

  it('keeps offline guidance explicit', () => {
    expect(offlineAuthMessage()).toContain('offline')
  })

  it('maps recovery-request, recovery-verify and password-update failures', () => {
    const rateLimited = authError('Over email send rate limit', 429, 'over_email_send_rate_limit')
    expect(authErrorKind(rateLimited)).toBe('rate_limit')
    expect(authErrorMessage(rateLimited, 'recovery-request')).toContain('Wait a minute')

    const wrongCode = authError('Invalid OTP', 400, 'invalid_credentials')
    expect(authErrorMessage(wrongCode, 'recovery-verify')).toContain('incorrect')

    const expiredCode = authError('Email OTP expired', 403, 'otp_expired')
    expect(authErrorMessage(expiredCode, 'recovery-verify')).toContain('expired')

    // The configured Supabase password policy is the strength authority.
    const weak = authError('Password is too weak', 422, 'weak_password')
    expect(authErrorKind(weak)).toBe('weak_password')
    expect(authErrorMessage(weak, 'password-update')).toContain('account requirements')

    // A dead recovery session (expired/missing) asks the user to restart.
    const deadSession = authError('Auth session missing!', 400, 'session_not_found')
    expect(authErrorKind(deadSession)).toBe('expired')
    expect(authErrorMessage(deadSession, 'password-update')).toContain('start again')

    expect(authErrorKind(new TypeError('Failed to fetch'))).toBe('network')
    expect(authErrorMessage(new TypeError('Failed to fetch'), 'recovery-request')).toContain(
      'connection',
    )
  })
})
