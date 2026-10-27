import { describe, it, expect } from 'vitest'
import { buildBackup, backupFilename, serializeBackup, type BackupRow } from './backup'

const SUBSET = { habits: [], entries: [], settings: null, includeProfile: false } as const

function habit(extra: Partial<BackupRow> = {}): BackupRow {
  return {
    id: 'h1',
    user_id: 'user-1',
    name: 'Read',
    type: 'boolean',
    archived: false,
    ...extra,
  }
}

describe('buildBackup', () => {
  it('produces the fixed document shape with schemaVersion 1', () => {
    const backup = buildBackup({
      ...SUBSET,
      habits: [habit()],
      entries: [],
      settings: { user_id: 'user-1', day_start_hour: 4, updated_at: '2026-10-27T01:00:00Z' },
      exportedAt: '2026-10-27T05:30:00.000Z',
    })
    expect(backup.app).toBe('habit-tracker')
    expect(backup.schemaVersion).toBe(1)
    expect(backup.exportedAt).toBe('2026-10-27T05:30:00.000Z')
    expect(backup.timezone).toBe('Asia/Kolkata')
    expect(Object.keys(backup).sort()).toEqual(
      ['app', 'entries', 'exportedAt', 'habits', 'schemaVersion', 'settings', 'timezone'].sort(),
    )
  })

  it('strips user_id from habits, entries and settings but keeps every other column', () => {
    const backup = buildBackup({
      ...SUBSET,
      habits: [habit({ future_column: 'migrated' })],
      entries: [
        { id: 'e1', user_id: 'user-1', habit_id: 'h1', date: '2026-10-26', value: 1 },
        { id: 'e2', user_id: 'user-1', habit_id: 'h1', date: '2026-10-27', value: 3, value2: 'x' },
      ],
      settings: { user_id: 'user-1', day_start_hour: 4 },
      exportedAt: '2026-10-27T05:30:00.000Z',
    })
    expect(backup.habits[0].user_id).toBeUndefined()
    expect(backup.habits[0].name).toBe('Read')
    expect(backup.habits[0].future_column).toBe('migrated')
    expect(backup.entries[0].user_id).toBeUndefined()
    expect(backup.entries[0].date).toBe('2026-10-26')
    expect(backup.settings.user_id).toBeUndefined()
    expect(backup.settings.day_start_hour).toBe(4)
  })

  it('includes archived habits and every entry (count preserved)', () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      user_id: 'u',
      habit_id: 'h1',
      date: `2026-10-2${i}`,
      value: i,
    }))
    const backup = buildBackup({
      ...SUBSET,
      habits: [habit({ archived: true, id: 'h2' }), habit()],
      entries,
      settings: null,
      exportedAt: '2026-10-27T05:30:00.000Z',
    })
    expect(backup.habits.some((h) => h.archived === true)).toBe(true)
    expect(backup.habits).toHaveLength(2)
    expect(backup.entries).toHaveLength(entries.length)
  })

  it('falls back to {} when the settings row does not exist', () => {
    const backup = buildBackup({ ...SUBSET, habits: [], entries: [], exportedAt: '2026-10-27T05:30:00.000Z' })
    expect(backup.settings).toEqual({})
  })

  it('omits profile unless requested, and never exports avatar_path or email', () => {
    const profile: BackupRow = {
      user_id: 'user-1',
      full_name: 'Test',
      gender: 'other',
      avatar_path: 'user-1/avatar.webp',
      email: 'secret@example.com',
    }
    const withoutProfile = buildBackup({
      ...SUBSET,
      habits: [],
      entries: [],
      profile,
      exportedAt: '2026-10-27T05:30:00.000Z',
    })
    expect(withoutProfile.profile).toBeUndefined()

    const withProfile = buildBackup({
      ...SUBSET,
      habits: [],
      entries: [],
      profile,
      includeProfile: true,
      exportedAt: '2026-10-27T05:30:00.000Z',
    })
    expect(withProfile.profile?.full_name).toBe('Test')
    expect(withProfile.profile?.avatar_path).toBeUndefined()
    expect(withProfile.profile?.email).toBeUndefined()
    expect(withProfile.profile?.user_id).toBeUndefined()
  })

  it('serializes pretty-printed JSON', () => {
    const backup = buildBackup({ ...SUBSET, habits: [], entries: [], exportedAt: '2026-10-27T05:30:00.000Z' })
    const text = serializeBackup(backup)
    expect(text).toContain('{\n  "app": "habit-tracker"')
    expect(JSON.parse(text)).toEqual(backup)
  })
})

describe('backupFilename', () => {
  it('uses the Asia/Kolkata calendar date (never toISOString UTC)', () => {
    // 2026-10-27 18:30 UTC = 2026-10-28 00:00 IST — an UTC slice would say the 27th.
    const ist = new Date('2026-10-27T18:30:00Z')
    expect(backupFilename(ist)).toBe('habit-tracker-backup-2026-10-28.json')
  })

  it('formats a mid-day instant', () => {
    expect(backupFilename(new Date('2026-10-27T10:00:00+05:30'))).toBe(
      'habit-tracker-backup-2026-10-27.json',
    )
  })
})
