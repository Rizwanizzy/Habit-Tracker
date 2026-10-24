import { describe, expect, it } from 'vitest'
import { contrast, readableColor, surfaceColor, tint } from './color'

describe('tint', () => {
  it('returns a color-mix string at the given percent', () => {
    expect(tint('#FF8800', 22)).toBe('color-mix(in srgb, #ff8800 22%, transparent)')
  })

  it('normalizes 3-digit hex and rounds fractional percents', () => {
    expect(tint('#7c8', 55.4)).toBe('color-mix(in srgb, #77cc88 55%, transparent)')
  })
})

describe('contrast', () => {
  it('computes the WCAG ratio (white vs black is 21)', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21)
  })
})

describe('readableColor', () => {
  it('keeps colors that already pass 3:1 unchanged', () => {
    expect(readableColor('#7C83FF', 'dark')).toBe('#7c83ff')
    expect(readableColor('#4F46E5', 'light')).toBe('#4f46e5')
  })

  it('raises a very dark color until it reads on the dark surface', () => {
    const dark = surfaceColor('dark')
    const result = readableColor('#0A0A0A', 'dark')
    expect(result).not.toBe('#0a0a0a')
    expect(contrast(result, dark)).toBeGreaterThanOrEqual(3)
    expect(contrast(result, dark)).toBeGreaterThan(contrast('#0A0A0A', dark))
  })

  it('lowers a very light color until it reads on the light surface', () => {
    const light = surfaceColor('light')
    const result = readableColor('#F5F5F5', 'light')
    expect(result).not.toBe('#f5f5f5')
    expect(contrast(result, light)).toBeGreaterThanOrEqual(3)
  })

  it('accepts 3-digit hex', () => {
    expect(readableColor('#fff', 'dark')).toBe('#ffffff')
  })

  it('rejects invalid input instead of returning garbage', () => {
    expect(() => readableColor('teal', 'dark')).toThrow()
  })
})
