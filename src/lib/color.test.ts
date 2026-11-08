import { describe, expect, it } from 'vitest'
import { contrast, isDarkTheme, readableColor, surfaceColor, tint } from './color'

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

describe('surfaceColor & isDarkTheme', () => {
  it('returns appropriate surfaces for all resolved themes', () => {
    expect(surfaceColor('light')).toBe('#f8fafc')
    expect(surfaceColor('dark')).toBe('#13161e')
    expect(surfaceColor('sepia')).toBe('#fbf7ee')
    expect(surfaceColor('oled')).toBe('#000000')
    expect(surfaceColor('solarized-light')).toBe('#eee8d5')
    expect(surfaceColor('solarized-dark')).toBe('#073642')
    expect(surfaceColor('high-contrast')).toBe('#000000')
  })

  it('correctly classifies dark themes', () => {
    expect(isDarkTheme('dark')).toBe(true)
    expect(isDarkTheme('oled')).toBe(true)
    expect(isDarkTheme('solarized-dark')).toBe(true)
    expect(isDarkTheme('high-contrast')).toBe(true)
    expect(isDarkTheme('light')).toBe(false)
    expect(isDarkTheme('sepia')).toBe(false)
    expect(isDarkTheme('solarized-light')).toBe(false)
  })
})

describe('readableColor across multi-theme surfaces', () => {
  it('adjusts dark colors for OLED and solarized-dark', () => {
    const oledSurface = surfaceColor('oled')
    const resOled = readableColor('#050505', 'oled')
    expect(contrast(resOled, oledSurface)).toBeGreaterThanOrEqual(3)

    const solDarkSurface = surfaceColor('solarized-dark')
    const resSolDark = readableColor('#031d24', 'solarized-dark')
    expect(contrast(resSolDark, solDarkSurface)).toBeGreaterThanOrEqual(3)
  })

  it('adjusts light colors for Sepia and Solarized-Light', () => {
    const sepiaSurface = surfaceColor('sepia')
    const resSepia = readableColor('#fffef9', 'sepia')
    expect(contrast(resSepia, sepiaSurface)).toBeGreaterThanOrEqual(3)

    const solLightSurface = surfaceColor('solarized-light')
    const resSolLight = readableColor('#fdfcf6', 'solarized-light')
    expect(contrast(resSolLight, solLightSurface)).toBeGreaterThanOrEqual(3)
  })

  it('ensures high contrast readability', () => {
    const hcSurface = surfaceColor('high-contrast')
    const res = readableColor('#111111', 'high-contrast')
    expect(contrast(res, hcSurface)).toBeGreaterThanOrEqual(3)
  })
})
