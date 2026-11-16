import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearRecoveryFlow,
  readRecoveryFlow,
  RESEND_COOLDOWN_MS,
  saveRecoveryFlow,
  startResendCooldown,
} from './recoveryFlow'

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
  clearRecoveryFlow()
})

describe('recovery flow state', () => {
  it('round-trips email + verified flag through sessionStorage (reload recovery)', () => {
    saveRecoveryFlow({ email: 'user@example.com', resendAfter: 0, verified: false })
    expect(readRecoveryFlow()).toEqual({ email: 'user@example.com', resendAfter: 0, verified: false })

    // After code verification the flag survives a reload — the password step
    // resumes without re-verifying (the recovery session lives in Supabase
    // storage, the step flag here).
    saveRecoveryFlow({ email: 'user@example.com', resendAfter: 0, verified: true })
    expect(readRecoveryFlow()).toEqual({ email: 'user@example.com', resendAfter: 0, verified: true })

    clearRecoveryFlow()
    expect(readRecoveryFlow()).toBeNull()
  })

  it('rejects invalid or malformed storage instead of trusting it', () => {
    backing.set('ht.recovery-flow', JSON.stringify({ email: 'not-an-email' }))
    expect(readRecoveryFlow()).toBeNull()

    backing.set('ht.recovery-flow', 'not-json')
    expect(readRecoveryFlow()).toBeNull()

    // verified must be strictly true — anything else is unverified.
    backing.set(
      'ht.recovery-flow',
      JSON.stringify({ email: 'user@example.com', verified: 'yes' }),
    )
    expect(readRecoveryFlow()).toEqual({
      email: 'user@example.com',
      resendAfter: 0,
      verified: false,
    })
  })

  it('keeps an active cooldown across a reload and expires it afterwards', () => {
    const now = Date.now()
    const resendAfter = startResendCooldown(now)
    saveRecoveryFlow({ email: 'USER@Example.com ', resendAfter, verified: false })

    expect(readRecoveryFlow(now)).toEqual({
      email: 'user@example.com',
      resendAfter,
      verified: false,
    })
    expect(resendAfter - now).toBe(RESEND_COOLDOWN_MS)

    // An expired cooldown collapses to 0 so the resend button unlocks.
    expect(readRecoveryFlow(now + RESEND_COOLDOWN_MS + 1)).toEqual({
      email: 'user@example.com',
      resendAfter: 0,
      verified: false,
    })
  })
})
