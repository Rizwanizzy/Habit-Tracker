import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RESEND_COOLDOWN_MS,
  clearVerifyEmailFlow,
  readVerifyEmailFlow,
  saveVerifyEmailFlow,
  startResendCooldown,
} from './verifyEmailFlow'

let backing = new Map<string, string>()

beforeEach(() => {
  backing = new Map()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => backing.set(key, value),
      removeItem: (key: string) => backing.delete(key),
    },
  })
})

afterEach(() => {
  clearVerifyEmailFlow()
})

describe('verify-email flow state', () => {
  it('round-trips a pending flow through sessionStorage (reload recovery)', () => {
    saveVerifyEmailFlow({ email: 'user@example.com', resendAfter: 0 })
    expect(readVerifyEmailFlow()).toEqual({ email: 'user@example.com', resendAfter: 0 })

    clearVerifyEmailFlow()
    expect(readVerifyEmailFlow()).toBeNull()
  })

  it('rejects invalid or sensitive data instead of trusting storage', () => {
    backing.set('ht.verify-email-flow', JSON.stringify({ email: 'not-an-email' }))
    expect(readVerifyEmailFlow()).toBeNull()

    backing.set('ht.verify-email-flow', 'not-json')
    expect(readVerifyEmailFlow()).toBeNull()

    // An expired cooldown collapses to 0 rather than blocking resends forever.
    backing.set(
      'ht.verify-email-flow',
      JSON.stringify({ email: 'user@example.com', resendAfter: Date.now() - 1000 }),
    )
    expect(readVerifyEmailFlow()).toEqual({ email: 'user@example.com', resendAfter: 0 })
  })

  it('keeps an active cooldown across a reload', () => {
    const now = Date.now()
    const resendAfter = startResendCooldown(now)
    saveVerifyEmailFlow({ email: 'USER@Example.com ', resendAfter })
    expect(readVerifyEmailFlow(now)).toEqual({
      email: 'user@example.com',
      resendAfter,
    })
    expect(resendAfter - now).toBe(RESEND_COOLDOWN_MS)
  })
})
