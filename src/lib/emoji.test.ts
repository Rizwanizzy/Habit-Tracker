import { describe, expect, it } from 'vitest'
import { EMOJI_MAX_CODE_POINTS, normalizeEmoji } from './emoji'

describe('normalizeEmoji', () => {
  it('returns null for blank or missing values', () => {
    expect(normalizeEmoji(null)).toBeNull()
    expect(normalizeEmoji(undefined)).toBeNull()
    expect(normalizeEmoji('')).toBeNull()
    expect(normalizeEmoji('   ')).toBeNull()
  })

  it('trims surrounding whitespace and keeps the emoji', () => {
    expect(normalizeEmoji('  🔥 ')).toBe('🔥')
    expect(normalizeEmoji('📚')).toBe('📚')
  })

  it('keeps multi-code-point emoji intact', () => {
    // ZWJ family and skin-tone modifier must not be split.
    expect(normalizeEmoji('👨‍👩‍👧')).toBe('👨‍👩‍👧')
    expect(normalizeEmoji('👨‍👩‍👧‍👦')).toBe('👨‍👩‍👧‍👦')
    expect(normalizeEmoji('🏋️‍♂️')).toBe('🏋️‍♂️')
    expect(normalizeEmoji('👋🏽')).toBe('👋🏽')
    // Regional-indicator flags are one grapheme made of two code points.
    expect(normalizeEmoji('🇮🇳')).toBe('🇮🇳')
  })

  it('keeps only the first grapheme when more than one is typed or pasted', () => {
    expect(normalizeEmoji('🔥📚')).toBe('🔥')
    expect(normalizeEmoji('🔥,📚')).toBe('🔥')
    expect(normalizeEmoji('👨‍👩‍👧🏃')).toBe('👨‍👩‍👧')
  })

  it('caps a pathological single grapheme at the code-point limit', () => {
    // One grapheme (base letter + combining marks) that exceeds the limit: the
    // DB check counts code points, so the value must still fit.
    const long = `a${'\u0301'.repeat(EMOJI_MAX_CODE_POINTS + 8)}`
    expect(Array.from(normalizeEmoji(long) ?? '')).toHaveLength(EMOJI_MAX_CODE_POINTS)
  })

  it('never splits surrogate pairs when the fallback path slices', () => {
    // Sanity check for the longest picker-produced sequences staying intact.
    const kiss = '👩‍❤️‍💋‍👨'
    expect(normalizeEmoji(kiss)).toBe(kiss)
    expect(Array.from(kiss).length).toBeLessThanOrEqual(EMOJI_MAX_CODE_POINTS)
  })
})
