import { describe, expect, it } from 'vitest'
import {
  emailFromLocationState,
  isCompleteOtp,
  isValidEmail,
  normalizeEmail,
  otpSlots,
  sanitizeOtp,
} from './authEmail'

describe('auth email + OTP helpers', () => {
  it('normalizes signup emails without changing the address', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
    expect(isValidEmail(' User@Example.COM ')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
  })

  it('rejects non-numeric OTP characters and preserves leading zeros', () => {
    expect(sanitizeOtp('12-34')).toBe('1234')
    expect(sanitizeOtp('12a3456789')).toBe('123456')
    expect(sanitizeOtp('001234')).toBe('001234')
    expect(isCompleteOtp('001234')).toBe(true)
    expect(isCompleteOtp('00123')).toBe(false)
    expect(isCompleteOtp('0012345')).toBe(false)
  })

  it('renders six stable OTP slots', () => {
    expect(otpSlots('0012')).toEqual(['0', '0', '1', '2', '', ''])
    expect(otpSlots('')).toHaveLength(6)
  })

  it('safely reads an email from navigation state', () => {
    expect(emailFromLocationState({ email: ' User@Example.COM ' })).toBe('user@example.com')
    expect(emailFromLocationState({ email: 'not-an-email' })).toBeNull()
    expect(emailFromLocationState({ email: 42 })).toBeNull()
    expect(emailFromLocationState(null)).toBeNull()
  })
})
