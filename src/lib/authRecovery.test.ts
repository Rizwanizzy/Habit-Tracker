import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  requestRecoveryOtp,
  resendRecoveryOtp,
  signOutRecoverySession,
  updateUserPassword,
  validatePasswordPair,
  verifyRecoveryOtp,
} from './authRecovery'

function mockClient(): SupabaseClient {
  return {
    auth: {
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  } as unknown as SupabaseClient
}

// The wrappers only read session/user presence and error status/code, so
// tests build minimal { data, error } responses and cast instead of
// assembling full User/Session/AuthError fixtures.
type RecoveryRequestResult = Awaited<ReturnType<SupabaseClient['auth']['resetPasswordForEmail']>>
type VerifyResult = Awaited<ReturnType<SupabaseClient['auth']['verifyOtp']>>
type UpdateResult = Awaited<ReturnType<SupabaseClient['auth']['updateUser']>>
type SignOutResult = Awaited<ReturnType<SupabaseClient['auth']['signOut']>>

function authResponse<T>(data: unknown, error: unknown = null): T {
  return { data, error } as unknown as T
}

describe('password recovery actions', () => {
  it('requests a recovery code via resetPasswordForEmail (no redirect link)', async () => {
    const client = mockClient()
    vi.mocked(client.auth.resetPasswordForEmail).mockResolvedValue(
      authResponse<RecoveryRequestResult>({}),
    )

    const result = await requestRecoveryOtp(client, 'user@example.com')
    expect(result).toEqual({ ok: true })
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com')
  })

  it('recovery resend is another recovery request — never a signup resend', async () => {
    const client = mockClient()
    vi.mocked(client.auth.resetPasswordForEmail).mockResolvedValue(
      authResponse<RecoveryRequestResult>({}),
    )

    const result = await resendRecoveryOtp(client, 'user@example.com')
    expect(result).toEqual({ ok: true })
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com')
    expect(client.auth.verifyOtp).not.toHaveBeenCalled()
    // The signup-only resend API must never be used for recovery.
    expect((client.auth as unknown as Record<string, unknown>)['resend']).toBeUndefined()
  })

  it('surfaces request errors (rate limit, offline, provider)', async () => {
    const client = mockClient()
    const rateLimited = new Error('Over email send rate limit')
    Object.assign(rateLimited, { status: 429, code: 'over_email_send_rate_limit' })
    vi.mocked(client.auth.resetPasswordForEmail).mockResolvedValue(
      authResponse<RecoveryRequestResult>(null, rateLimited),
    )

    const result = await requestRecoveryOtp(client, 'user@example.com')
    expect(result.ok).toBe(false)
  })

  it('verifies a 6-digit recovery OTP with type recovery', async () => {
    const client = mockClient()
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(
      authResponse<VerifyResult>({ user: {}, session: { access_token: 'access-token' } }),
    )

    const result = await verifyRecoveryOtp(client, 'user@example.com', '001234')
    expect(result.ok).toBe(true)
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '001234',
      type: 'recovery',
    })
  })

  it('does not call Supabase for a partial OTP and rejects invalid/expired codes', async () => {
    const client = mockClient()
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(
      authResponse<VerifyResult>({ user: null, session: null }, new Error('Invalid OTP')),
    )

    await expect(verifyRecoveryOtp(client, 'user@example.com', '00123')).resolves.toMatchObject({
      ok: false,
    })
    expect(client.auth.verifyOtp).not.toHaveBeenCalled()

    const expired = new Error('Email OTP expired')
    Object.assign(expired, { status: 403, code: 'otp_expired' })
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(
      authResponse<VerifyResult>({ user: null, session: null }, expired),
    )
    await expect(verifyRecoveryOtp(client, 'user@example.com', '001234')).resolves.toMatchObject({
      ok: false,
    })
  })

  it('requires a real recovery session before treating verification as successful', async () => {
    const client = mockClient()
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(
      authResponse<VerifyResult>({ user: {}, session: null }),
    )

    await expect(verifyRecoveryOtp(client, 'user@example.com', '001234')).resolves.toMatchObject({
      ok: false,
    })
  })

  it('updates the password with updateUser and requires a real user', async () => {
    const client = mockClient()
    vi.mocked(client.auth.updateUser).mockResolvedValue(
      authResponse<UpdateResult>({ user: { id: 'u1' } }),
    )

    const result = await updateUserPassword(client, 'new-secret')
    expect(result).toEqual({ ok: true })
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' })

    vi.mocked(client.auth.updateUser).mockResolvedValue(
      authResponse<UpdateResult>({ user: null }),
    )
    await expect(updateUserPassword(client, 'new-secret')).resolves.toMatchObject({ ok: false })
  })

  it('signs out the recovery session best-effort', async () => {
    const client = mockClient()
    vi.mocked(client.auth.signOut).mockResolvedValue(authResponse<SignOutResult>(undefined))

    await expect(signOutRecoverySession(client)).resolves.toEqual({ ok: true })
    expect(client.auth.signOut).toHaveBeenCalled()
  })

  it('validates the password pair without inventing strength rules', () => {
    expect(validatePasswordPair('', '')).toBe('Enter a new password.')
    expect(validatePasswordPair('abc', 'xyz')).toBe('Passwords don’t match.')
    // Strength is the configured Supabase policy — anything non-empty passes.
    expect(validatePasswordPair('a', 'a')).toBeNull()
  })
})
