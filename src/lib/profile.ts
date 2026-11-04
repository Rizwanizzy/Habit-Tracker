import { todayString } from './dates'

export type Gender = 'female' | 'male' | 'other' | 'prefer_not_to_say'

export const GENDERS: readonly Gender[] = ['female', 'male', 'other', 'prefer_not_to_say'] as const

export interface Profile {
  user_id: string
  full_name: string | null
  bio: string | null
  date_of_birth: string | null // YYYY-MM-DD
  gender: Gender | null
  nationality: string | null
  country: string | null
  address: string | null
  phone: string | null
  avatar_path: string | null
  updated_at: string | null
}

/** Editable subset of a profile (server-managed fields excluded). */
export type ProfileInput = Omit<Profile, 'user_id' | 'updated_at'>

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value)
}

/** Normalize bio: trim, convert newlines and tabs to single spaces; empty -> null. */
export function normalizeBio(value: string | null | undefined): string | null {
  if (value == null) return null
  const collapsed = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  return collapsed.length === 0 ? null : collapsed
}

/** Bio: optional Quote line, max 140 code points matching Postgres char_length. */
export function validateBio(value: string | null | undefined): string | null {
  const normalized = normalizeBio(value)
  if (normalized == null) return null
  if (Array.from(normalized).length > 140) {
    return 'Keep it under 140 characters'
  }
  return null
}

/** Full name: optional, but no more than 80 characters. */
export function validateFullName(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > 80) return 'Full name must be at most 80 characters'
  return null
}

/** Date of birth: optional, YYYY-MM-DD, on/after 1900, not in the future.
 *  `today` is the logical today (optional; defaults to the plain local date
 *  so the pure function keeps its old behaviour without a setting). */
export function validateDateOfBirth(value: string | null, today: string = todayString()): string | null {
  if (value == null || value.trim() === '') return null
  const v = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Date of birth must be YYYY-MM-DD'
  if (v < '1900-01-01') return 'Date of birth must be on or after 1900'
  if (v > today) return 'Date of birth cannot be in the future'
  return null
}

/** Phone: optional; 7–15 digits with an optional leading + and common separators. */
export function validatePhone(value: string | null): string | null {
  if (value == null || value.trim() === '') return null
  const normalized = value.trim().replace(/[\s\-().]/g, '')
  if (!/^\+?\d{7,15}$/.test(normalized)) {
    return 'Phone must be 7–15 digits with an optional leading +'
  }
  return null
}

/** Gender: optional, but must be one of the allowed values when present. */
export function validateGender(value: Gender | null): string | null {
  if (value == null) return null
  if (!isGender(value)) return 'Gender must be one of the allowed values'
  return null
}

export function validateProfile(input: ProfileInput, today: string = todayString()): { valid: boolean; errors: ProfileErrors } {
  const errors: ProfileErrors = {}
  const fn = validateFullName(input.full_name)
  if (fn) errors.full_name = fn
  const bio = validateBio(input.bio)
  if (bio) errors.bio = bio
  const dob = validateDateOfBirth(input.date_of_birth, today)
  if (dob) errors.date_of_birth = dob
  const ph = validatePhone(input.phone)
  if (ph) errors.phone = ph
  const g = validateGender(input.gender)
  if (g) errors.gender = g
  return { valid: Object.keys(errors).length === 0, errors }
}

/** Up to two uppercase initials for an avatar fallback. */
export function initialsFrom(name: string | null, email: string | null): string {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) {
    const local = (email ?? '').split('@')[0]?.trim() ?? ''
    if (local.length === 0) return '?'
    return local.charAt(0).toUpperCase()
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  const word = parts[0]
  if (word.length >= 2) return word.slice(0, 2).toUpperCase()
  return word.charAt(0).toUpperCase()
}
