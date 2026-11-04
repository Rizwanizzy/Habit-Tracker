import { describe, expect, it } from 'vitest'
import { newId } from './id'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns a v4 UUID when crypto.randomUUID is available', () => {
    expect(newId()).toMatch(UUID_RE)
  })

  it('never throws when crypto.randomUUID is missing (insecure origins)', () => {
    const real = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    try {
      expect(newId()).toMatch(UUID_RE)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', {
        value: real,
        configurable: true,
        writable: true,
      })
    }
  })

  it('produces unique ids', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) ids.add(newId())
    expect(ids.size).toBe(1000)
  })
})