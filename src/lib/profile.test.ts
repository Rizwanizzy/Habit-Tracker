import { describe, expect, it } from 'vitest'
import {
  GENDERS,
  initialsFrom,
  isGender,
  normalizeBio,
  validateBio,
  validateDateOfBirth,
  validateFullName,
  validateGender,
  validatePhone,
  validateProfile,
} from './profile'

describe('validateFullName', () => {
  it('allows null and empty', () => {
    expect(validateFullName(null)).toBeNull()
    expect(validateFullName('')).toBeNull()
    expect(validateFullName('   ')).toBeNull()
  })
  it('allows up to 80 characters', () => {
    expect(validateFullName('A'.repeat(80))).toBeNull()
  })
  it('rejects more than 80 characters', () => {
    expect(validateFullName('A'.repeat(81))).not.toBeNull()
  })
})

describe('validateDateOfBirth', () => {
  it('allows null and empty', () => {
    expect(validateDateOfBirth(null)).toBeNull()
    expect(validateDateOfBirth('')).toBeNull()
  })
  it('rejects malformed input', () => {
    expect(validateDateOfBirth('1990/01/01')).not.toBeNull()
  })
  it('rejects dates before 1900', () => {
    expect(validateDateOfBirth('1899-12-31')).not.toBeNull()
  })
  it('rejects future dates', () => {
    expect(validateDateOfBirth('2999-01-01')).not.toBeNull()
  })
  it('accepts a valid past date', () => {
    expect(validateDateOfBirth('1990-05-12')).toBeNull()
  })
  it('accepts 1900-01-01', () => {
    expect(validateDateOfBirth('1900-01-01')).toBeNull()
  })
})

describe('validatePhone', () => {
  it('allows null and empty', () => {
    expect(validatePhone(null)).toBeNull()
    expect(validatePhone('')).toBeNull()
  })
  it('accepts 7–15 digits with separators and optional +', () => {
    expect(validatePhone('1234567')).toBeNull()
    expect(validatePhone('+1 (555) 123-4567')).toBeNull()
    expect(validatePhone('12.34.56.78.90')).toBeNull()
  })
  it('rejects too few digits', () => {
    expect(validatePhone('123456')).not.toBeNull()
  })
  it('rejects too many digits', () => {
    expect(validatePhone('1234567890123456')).not.toBeNull()
  })
  it('rejects non-numeric junk', () => {
    expect(validatePhone('call-me')).not.toBeNull()
  })
})

describe('validateGender', () => {
  it('allows null and empty', () => {
    expect(validateGender(null)).toBeNull()
  })
  it('accepts every allowed value', () => {
    for (const g of GENDERS) expect(validateGender(g)).toBeNull()
  })
  it('rejects unknown values', () => {
    expect(validateGender('robot' as never)).not.toBeNull()
  })
})

describe('isGender', () => {
  it('narrows correctly', () => {
    expect(isGender('female')).toBe(true)
    expect(isGender('nope')).toBe(false)
    expect(isGender(42)).toBe(false)
  })
})

describe('validateBio', () => {
  it('allows null and empty', () => {
    expect(validateBio(null)).toBeNull()
    expect(validateBio('')).toBeNull()
    expect(validateBio('   ')).toBeNull()
    expect(validateBio('\n\t  ')).toBeNull()
  })

  it('normalizes by trimming and collapsing whitespace', () => {
    expect(normalizeBio('  Keep   going  \n strong! \t')).toBe('Keep going strong!')
    expect(normalizeBio('   ')).toBeNull()
    expect(normalizeBio(null)).toBeNull()
  })

  it('allows exactly 140 characters', () => {
    const exactly140 = 'a'.repeat(140)
    expect(validateBio(exactly140)).toBeNull()
  })

  it('rejects 141 characters', () => {
    const chars141 = 'a'.repeat(141)
    expect(validateBio(chars141)).toBe('Keep it under 140 characters')
  })

  it('counts unicode code points correctly for emojis', () => {
    // 140 emojis: each emoji is 1 code point, so 140 emojis is exactly 140
    const emojis140 = '🔥'.repeat(140)
    expect(Array.from(emojis140).length).toBe(140)
    expect(validateBio(emojis140)).toBeNull()

    const emojis141 = '🔥'.repeat(141)
    expect(Array.from(emojis141).length).toBe(141)
    expect(validateBio(emojis141)).toBe('Keep it under 140 characters')
  })

  it('validates collapsed text rather than raw newlines', () => {
    // 'a' * 139 with newlines that collapse to spaces
    const multiline = 'a'.repeat(70) + '\n\t  \n' + 'b'.repeat(69)
    expect(validateBio(multiline)).toBeNull()
  })
})

describe('validateProfile', () => {
  it('returns valid with no errors for an empty profile', () => {
    const r = validateProfile({
      full_name: null,
      bio: null,
      date_of_birth: null,
      gender: null,
      nationality: null,
      country: null,
      address: null,
      phone: null,
      avatar_path: null,
    })
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual({})
  })
  it('collects multiple errors at once', () => {
    const r = validateProfile({
      full_name: 'A'.repeat(81),
      bio: 'B'.repeat(141),
      date_of_birth: '2999-01-01',
      gender: 'robot' as never,
      nationality: null,
      country: null,
      address: null,
      phone: '12',
      avatar_path: null,
    })
    expect(r.valid).toBe(false)
    expect(r.errors.full_name).toBeDefined()
    expect(r.errors.bio).toBe('Keep it under 140 characters')
    expect(r.errors.date_of_birth).toBeDefined()
    expect(r.errors.gender).toBeDefined()
    expect(r.errors.phone).toBeDefined()
  })
})

describe('initialsFrom', () => {
  it('uses first + last name initials', () => {
    expect(initialsFrom('Ada Lovelace', 'ada@example.com')).toBe('AL')
  })
  it('uses first two letters for a single name', () => {
    expect(initialsFrom('Madonna', 'm@example.com')).toBe('MA')
  })
  it('falls back to the email local part when name is empty', () => {
    expect(initialsFrom(null, 'john.doe@example.com')).toBe('J')
    expect(initialsFrom('   ', 'zoe@example.com')).toBe('Z')
  })
  it('returns ? when both are empty', () => {
    expect(initialsFrom(null, null)).toBe('?')
    expect(initialsFrom('', '')).toBe('?')
  })
  it('handles a single-character name', () => {
    expect(initialsFrom('X', 'x@example.com')).toBe('X')
  })
})
