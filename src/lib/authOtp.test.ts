import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSingleFlight,
  resendSignupOtp,
  startEmailSignin,
  startEmailSignup,
  startGoogleSignin,
  verifySignupOtp,
} from './authOtp'

function mockClient(): SupabaseClient {
  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
  } as unknown as SupabaseClient
}

// The wrappers only read session presence, identities length and error
// status/code, so tests build minimal { data, error } responses and cast
// instead of assembling full User/Session/AuthError fixtures.
type SignUpResult = Awaited<ReturnType<SupabaseClient['auth']['signUp']>>
type SigninResult = Awaited<ReturnType<SupabaseClient['auth']['signInWithPassword']>>
type OAuthResult = Awaited<ReturnType<SupabaseClient['auth']['signInWithOAuth']>>
type VerifyResult = Awaited<ReturnType<SupabaseClient['auth']['verifyOtp']>>
type ResendResult = Awaited<ReturnType<SupabaseClient['auth']['resend']>>

function authResponse<T>(data: unknown, error: unknown = null): T {
  return { data, error } as unknown as T
}

describe('email signup + OTP auth actions', () => {
  it('sends a signup OTP when Supabase returns a user without a session', async () => {
    const client = mockClient()
    vi.mocked(client.auth.signUp).mockResolvedValue(authResponse<SignUpResult>({
      user: { identities: [{}] },
      session: null,
    }))

    const result = await startEmailSignup(client, 'user@example.com', 'secret')
    expect(result).toEqual({
      ok: true,
      destination: { kind: 'verify-email', email: 'user@example.com' },
    })
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret' })
  })

  it('keeps the authenticated flow when signup auto-confirms a session', async () => {
    const client = mockClient()
    vi.mocked(client.auth.signUp).mockResolvedValue(authResponse<SignUpResult>({
      user: {},
      session: { access_token: 'access-token' },
    }))

    const result = await startEmailSignup(client, 'user@example.com', 'secret')
    expect(result).toEqual({ ok: true, destination: { kind: 'app' } })
  })

  it('does not send users to OTP verification for an existing email', async () => {
    const client = mockClient()
    vi.mocked(client.auth.signUp).mockResolvedValue(authResponse<SignUpResult>({
      user: { identities: [] },
      session: null,
    }))

    const result = await startEmailSignup(client, 'user@example.com', 'secret')
    expect(result.ok).toBe(false)
  })

  it('verifies a 6-digit email OTP with type email', async () => {
    const client = mockClient()
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(authResponse<VerifyResult>({
      user: {},
      session: { access_token: 'access-token' },
    }))

    const result = await verifySignupOtp(client, 'user@example.com', '001234')
    expect(result.ok).toBe(true)
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '001234',
      type: 'email',
    })
  })

  it('does not call Supabase for a partial OTP and rejects invalid responses', async () => {
    const client = mockClient()
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(authResponse<VerifyResult>({
      user: null,
      session: null,
    }, new Error('Invalid OTP')))

    await expect(verifySignupOtp(client, 'user@example.com', '00123')).resolves.toMatchObject({
      ok: false,
    })
    expect(client.auth.verifyOtp).not.toHaveBeenCalled()

    const expired = new Error('Email OTP expired')
    Object.assign(expired, { status: 403, code: 'otp_expired' })
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(authResponse<VerifyResult>({
      user: null,
      session: null,
    }, expired))
    await expect(verifySignupOtp(client, 'user@example.com', '001234')).resolves.toMatchObject({
      ok: false,
    })
  })

  it('requires a real session before treating verification as successful', async () => {
    const client = mockClient()
    vi.mocked(client.auth.verifyOtp).mockResolvedValue(authResponse<VerifyResult>({
      user: {},
      session: null,
    }))

    await expect(verifySignupOtp(client, 'user@example.com', '001234')).resolves.toMatchObject({
      ok: false,
    })
  })

  it('resends signup codes without creating a session', async () => {
    const client = mockClient()
    vi.mocked(client.auth.resend).mockResolvedValue(authResponse<ResendResult>({
      user: null,
      session: null,
    }))

    const result = await resendSignupOtp(client, 'user@example.com')
    expect(result).toEqual({ ok: true })
    expect(client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'user@example.com' })
  })

  it('preserves email/password and Google sign-in calls', async () => {
    const client = mockClient()
    vi.mocked(client.auth.signInWithPassword).mockResolvedValue(authResponse<SigninResult>({
      user: {},
      session: { access_token: 'access-token' },
    }))
    vi.mocked(client.auth.signInWithOAuth).mockResolvedValue(authResponse<OAuthResult>({
      provider: 'google',
      url: 'https://google',
    }))

    await expect(startEmailSignin(client, 'user@example.com', 'secret')).resolves.toEqual({
      ok: true,
      destination: { kind: 'app' },
    })
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
    })

    await expect(startGoogleSignin(client, 'https://app.example/login')).resolves.toEqual({
      ok: true,
      destination: { kind: 'app' },
    })
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.example/login' },
    })
  })

  it('prevents concurrent submissions at the action boundary', async () => {
    const flight = createSingleFlight()
    let resolveFirst: (value: string) => void = () => undefined
    const first = flight(
      () => new Promise<string>((resolve) => { resolveFirst = resolve }),
    )
    const second = flight(async () => 'second')

    await expect(second).resolves.toBeNull()
    resolveFirst('first')
    await expect(first).resolves.toBe('first')
    await expect(flight(async () => 'third')).resolves.toBe('third')
  })
})
