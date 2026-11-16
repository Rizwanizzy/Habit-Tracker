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
})
