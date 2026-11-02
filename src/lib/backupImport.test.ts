import { describe, expect, it } from 'vitest'
import type { BackupRow } from './backup'
import {
  maxBackupFileBytes,
  parseBackup,
  planImport,
  type ExistingEntry,
  type ExistingHabit,
  type ImportEntry,
  type ImportHabit,
} from './backupImport'

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'

function habitJson(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: UUID_A,
    name: 'Read',
    type: 'numeric',
    target: 30,
    unit: 'min',
    freq_times: 1,
    freq_days: 1,
    color: '#22D3EE',
    sort_order: 2,
    archived: false,
    created_at: '2026-01-10T05:30:00.000Z',
    ...extra,
  }
}

function entryJson(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { habit_id: UUID_A, date: '2026-10-26', value: 30, ...extra }
}

function parse(habits: unknown[] = [], entries: unknown[] = [], extra: object = {}) {
  return parseBackup(
    JSON.stringify({
      app: 'habit-tracker',
      schemaVersion: 1,
      exportedAt: '2026-10-27T05:30:00.000Z',
      habits,
      entries,
      ...extra,
    }),
  )
}

describe('parseBackup', () => {
  it('parses a valid file with the status column carried on entries', () => {
    const result = parse(
      [habitJson({ user_id: 'u1' })],
      [entryJson({ id: 'e1', user_id: 'u1', status: 'skipped' }), entryJson({ date: '2026-10-27', value: 10 })],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.habits).toHaveLength(1)
    expect(result.backup.habits[0]).toMatchObject({
      id: UUID_A,
      name: 'Read',
      target: 30,
      sort_order: 2,
      archived: false,
    })
    expect(result.backup.entries).toHaveLength(2)
    expect(result.backup.entries[0]).toEqual({ habit_id: UUID_A, date: '2026-10-26', value: 30, status: 'skipped' })
    // Entries missing status (backups made before the skip feature) default to 'done'.
    expect(result.backup.entries[1]).toEqual({ habit_id: UUID_A, date: '2026-10-27', value: 10, status: 'done' })
    expect(result.warnings).toEqual([])
  })

  it('carries the habit emoji, defaulting to null for older files', () => {
    const withEmoji = parse([habitJson({ emoji: '  🔥 ' })], [])
    expect(withEmoji.ok).toBe(true)
    if (!withEmoji.ok) return
    expect(withEmoji.backup.habits[0].emoji).toBe('🔥')

    // Backups made before the column existed simply have no emoji.
    const without = parse([habitJson()], [])
    expect(without.ok).toBe(true)
    if (!without.ok) return
    expect(without.backup.habits[0].emoji).toBeNull()

    // A non-string emoji is invalid input, not silently coerced.
    const bad = parse([habitJson({ emoji: 42 })], [])
    expect(bad.ok).toBe(true)
    if (!bad.ok) return
    expect(bad.backup.habits).toHaveLength(0)
  })

  it('rejects invalid JSON, a wrong app, and a too-new schemaVersion', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ app: 'other', schemaVersion: 1 }))).toMatchObject({ ok: false })
    expect(
      parseBackup(JSON.stringify({ app: 'habit-tracker', schemaVersion: 99, habits: [], entries: [] })),
    ).toMatchObject({ ok: false })
  })

  it('runs every field through its whitelist and drops bad rows with warnings', () => {
    const result = parse(
      [
        habitJson({ name: '', user_id: 'u1' }), // empty name
        habitJson({ id: 'not-a-uuid' }), // bad id
        habitJson({ type: 'other' }), // bad type
        habitJson({ freq_times: 0 }), // freq must be a positive int
        habitJson({ color: 'blue' }), // bad color
        habitJson({ created_at: '2026-01-10' }), // date-only is not a timestamp
        habitJson({ id: UUID_B, name: 'Good', future_column: 'rides-along' }), // stays
      ],
      [
        { ...entryJson({ habit_id: UUID_B }), date: '2026-02-30' }, // not a real calendar date
        entryJson({ habit_id: UUID_B, value: '30' }), // not a finite number
        entryJson({ habit_id: UUID_B, status: 'completed', date: '2026-10-25' }), // unknown status
        entryJson({ habit_id: UUID_B, date: '2026-10-25', value: 5 }), // valid
      ],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.habits).toHaveLength(1)
    expect(result.backup.habits[0].id).toBe(UUID_B)
    expect(Object.keys(result.backup.habits[0])).not.toContain('future_column')
    expect(result.backup.entries).toHaveLength(1)
    expect(result.backup.entries[0]).toEqual({
      habit_id: UUID_B,
      date: '2026-10-25',
      value: 5,
      status: 'done',
    })
    expect(result.warnings.join(' ')).toContain('6 invalid habit row')
    expect(result.warnings.join(' ')).toContain('3 invalid entries dropped')
  })

  it('dedupes (habit_id, date) entries last-one-wins and drops unknown habit refs', () => {
    const result = parse(
      [habitJson()],
      [
        entryJson({ user_id: 'u1', value: 1 }),
        entryJson({ value: 2 }), // same (habit_id, date) â€” last one wins
        entryJson({ habit_id: UUID_B, date: '2026-10-26', value: 9 }), // habit not in file
      ],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.entries).toHaveLength(1)
    expect(result.backup.entries[0].value).toBe(2)
    expect(result.warnings.join(' ')).toContain('habit not in the file')
  })

  it('tolerates a file with no settings/profile and drops a junk vacationPeriods row', () => {
    const result = parse([habitJson()], [], {
      vacationPeriods: [{ from: '2026-10-01', to: '2026-10-02' }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.settings).toEqual({})
    expect(result.backup.profile).toBeUndefined()
    // The junk vacation row drops with a counted warning (still additive).
    expect(result.backup.vacationPeriods).toEqual([])
    expect(result.warnings.join(' ')).toContain('1 invalid break row dropped.')
  })

  it('ignores user_id in rows and keeps the export size cap at 20 MB', () => {
    const result = parse(
      [habitJson({ user_id: 'someone-else' })],
      [entryJson({ user_id: 'someone-else' })],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.habits).toHaveLength(1)
    expect(result.backup.entries).toHaveLength(1)
    expect(maxBackupFileBytes).toBe(20 * 1024 * 1024)
  })
})

const existingHabit: ExistingHabit = {
  id: 'real-1',
  name: 'Read',
  created_at: '2026-01-10',
  sort_order: 4,
}

const backupHabit: ImportHabit = {
  id: UUID_A,
  name: 'Read',
  type: 'numeric',
  target: 30,
  unit: 'min',
  freq_times: 1,
  freq_days: 1,
  color: '#22d3ee',
  emoji: null,
  sort_order: 5,
  archived: false,
  created_at: '2026-01-10T05:30:00.000Z',
}

const backupEntry: ImportEntry = { habit_id: UUID_A, date: '2026-10-26', value: 30, status: 'done' }

function planWith(
  backupHabits: ImportHabit[],
  backupEntries: ImportEntry[],
  existingHabits: ExistingHabit[],
  existingEntries: ExistingEntry[],
  settings: BackupRow = {},
) {
  return planImport({
    backup: { exportedAt: '', habits: backupHabits, entries: backupEntries, settings, vacationPeriods: [] },
    existingHabits,
    existingEntries,
  })
}

describe('planImport', () => {
  it('matches by id first and remaps entries to the existing habit id', () => {
    const byId = planWith(
      [{ ...backupHabit, id: 'real-1', name: 'Renamed' }],
      [{ ...backupEntry, habit_id: 'real-1' }],
      [existingHabit],
      [],
    )
    expect(byId.habitsToCreate).toHaveLength(0)
    expect(byId.matchedHabitIds).toEqual(['real-1'])
    expect(byId.entriesToAdd[0]?.habit_id).toBe('real-1')
    expect(byId.counts).toEqual({ habitsNew: 0, habitsExisting: 1, entriesNew: 1, entriesExisting: 0, vacationsNew: 0, vacationsExisting: 0 })
  })

  it('falls back to case-insensitive name + created_at matching', () => {
    const renamed = planWith([backupHabit], [backupEntry], [{ ...existingHabit, id: 'other-id' }], [])
    expect(renamed.habitsToCreate).toHaveLength(0)
    expect(renamed.habitIdMap[UUID_A]).toBe('other-id')
    expect(renamed.entriesToAdd[0]?.habit_id).toBe('other-id')

    // Different created date â†’ no match: create new, keeping the ORIGINAL id.
    const different = planWith(
      [backupHabit],
      [],
      [{ ...existingHabit, created_at: '2025-06-01' }],
      [],
    )
    expect(different.habitsToCreate).toHaveLength(1)
    expect(different.habitsToCreate[0].id).toBe(UUID_A)
  })

  it('assigns new-habit sort_order = max(existing) + backup rank', () => {
    const p = planWith(
      [backupHabit, { ...backupHabit, id: UUID_B, name: 'Walk' }],
      [],
      [existingHabit, { id: 'x', name: 'X', created_at: '2025-01-01', sort_order: 7 }],
      [],
    )
    // 'Read' matches by name+date; 'Walk' is new â†’ 7 + 1.
    expect(p.habitsToCreate).toHaveLength(1)
    expect(p.habitsToCreate[0]).toMatchObject({ id: UUID_B, sort_order: 8 })
  })

  it('partitions entries by mapped habit id + date, and reports counts/dates', () => {
    const p = planWith([backupHabit], [backupEntry], [existingHabit], [
      { habit_id: 'real-1', date: '2026-10-26' },
    ])
    expect(p.entriesToAdd).toHaveLength(0)
    expect(p.entriesExistingCount).toBe(1)
    expect(p.counts).toEqual({ habitsNew: 0, habitsExisting: 1, entriesNew: 0, entriesExisting: 1, vacationsNew: 0, vacationsExisting: 0 })
    expect(p.firstDate).toBe('2026-10-26')
    expect(p.lastDate).toBe('2026-10-26')
  })

  it('yields an empty plan when the same data is imported twice (idempotent)', () => {
    const p = planWith(
      [{ ...backupHabit, id: 'real-1', sort_order: 4 }],
      [{ ...backupEntry, habit_id: 'real-1' }],
      [existingHabit],
      [{ habit_id: 'real-1', date: '2026-10-26' }],
    )
    expect(p.habitsToCreate).toHaveLength(0)
    expect(p.entriesToAdd).toHaveLength(0)
    expect(p.counts).toEqual({ habitsNew: 0, habitsExisting: 1, entriesNew: 0, entriesExisting: 1, vacationsNew: 0, vacationsExisting: 0 })
  })

  it('flags settings/profile availability', () => {
    const withBoth = planWith([], [], [], [], { day_start_hour: 3, user_id: 'u' })
    const withProfile = planImport({
      backup: {
        exportedAt: '',
        habits: [],
        entries: [],
        settings: {},
        profile: { full_name: 'T' },
        vacationPeriods: [],
      },
      existingHabits: [],
      existingEntries: [],
      warnings: [],
    })
    expect(withBoth.hasSettings).toBe(true)
    expect(withBoth.hasProfile).toBe(false)
    expect(withProfile.hasProfile).toBe(true)
    expect(withBoth.firstDate).toBeNull()
    expect(withBoth.lastDate).toBeNull()
  })
})

describe('vacationPeriods (parse + plan)', () => {
  function periodJson(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: UUID_B,
      user_id: 'u1',
      start_date: '2026-10-12',
      end_date: '2026-10-18',
      created_at: '2026-10-19T01:00:00.000Z',
      ...extra,
    }
  }

  it('parses valid periods through the whitelist (user_id dropped, null end kept)', () => {
    const result = parse([], [], { vacationPeriods: [periodJson({ end_date: null, junk: 'x' })] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.vacationPeriods).toEqual([
      {
        id: UUID_B,
        start_date: '2026-10-12',
        end_date: null,
        created_at: '2026-10-19T01:00:00.000Z',
      },
    ])
    expect(result.warnings).toEqual([])
  })

  it('drops invalid rows with a warning and dedupes ids (first wins)', () => {
    const result = parse([], [], {
      vacationPeriods: [
        periodJson({ created_at: 'nope' }),
        periodJson({ id: 'not-a-uuid' }),
        periodJson({ start_date: '2026-02-30' }),
        periodJson({ end_date: '2026-10-10' }), // end before start
        periodJson({ created_at: '2026-10-20T00:00:00.000Z' }), // duplicate id after one kept
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.vacationPeriods).toHaveLength(1)
    expect(result.warnings.join(' ')).toContain('4 invalid break rows dropped.')
  })

  it('tolerates a wrong-shape key and files without the key', () => {
    const wrong = parse([], [], { vacationPeriods: { nope: true } })
    expect(wrong.ok && wrong.warnings.join(' ').includes('vacationPeriods')).toBe(true)
    const absent = parse([], [])
    expect(absent.ok && absent.backup.vacationPeriods).toEqual([])
  })

  it('plans new periods, dedupes by id and by (start, end) pair, and never deletes', () => {
    const result = parse([], [], { vacationPeriods: [periodJson()] })
    if (!result.ok) throw new Error('parse failed')
    const backup = result.backup

    const planned = planImport({ backup, existingHabits: [], existingEntries: [] })
    expect(planned.vacationsToAdd).toHaveLength(1)
    expect(planned.counts.vacationsNew).toBe(1)

    // Same id in the app â†’ existing, planning nothing.
    const sameId = planImport({
      backup,
      existingHabits: [],
      existingEntries: [],
      existingVacations: [{ id: UUID_B, start_date: '2026-10-12', end_date: '2026-10-18' }],
    })
    expect(sameId.vacationsToAdd).toEqual([])
    expect(sameId.counts.vacationsExisting).toBe(1)

    // Same dates, different id â†’ also matched (idempotent across device moves).
    const samePair = planImport({
      backup,
      existingHabits: [],
      existingEntries: [],
      existingVacations: [{ id: UUID_A, start_date: '2026-10-12', end_date: '2026-10-18' }],
    })
    expect(samePair.vacationsToAdd).toEqual([])

    // Re-planning the SAME plan output (simulating a failed run re-run).
    const again = planImport({
      backup,
      existingHabits: [],
      existingEntries: [],
      existingVacations: planned.vacationsToAdd.map((p) => ({ id: p.id, start_date: p.start_date, end_date: p.end_date })),
    })
    expect(again.counts.vacationsNew).toBe(0)
  })

  it('drops candidates that would overlap existing breaks, with a warning', () => {
    const result = parse([], [], {
      vacationPeriods: [periodJson({ start_date: '2026-10-17', end_date: '2026-10-19' }), periodJson({ id: '33333333-3333-4333-8333-333333333333', start_date: '2026-10-12', end_date: '2026-10-18' })],
    })
    if (!result.ok) throw new Error('parse failed')
    const plan = planImport({
      backup: result.backup,
      existingHabits: [],
      existingEntries: [],
      existingVacations: [{ id: UUID_A, start_date: '2026-10-18', end_date: '2026-10-18' }],
    })
    expect(plan.vacationsToAdd).toEqual([])
    expect(plan.warnings.join(' ')).toContain('2 breaks not restored')
  })

  it('an ongoing backup period overlaps a live ongoing period and is dropped', () => {
    const result = parse([], [], { vacationPeriods: [periodJson({ end_date: null })] })
    if (!result.ok) throw new Error('parse failed')
    const plan = planImport({
      backup: result.backup,
      existingHabits: [],
      existingEntries: [],
      existingVacations: [{ id: UUID_A, start_date: '2026-10-01', end_date: null }],
    })
    expect(plan.vacationsToAdd).toEqual([])
    expect(plan.counts.vacationsExisting).toBe(0)
  })

  it('own-file duplicates never plan twice', () => {
    const result = parse([], [], {
      vacationPeriods: [periodJson(), periodJson({ id: UUID_A, start_date: '2026-10-12', end_date: '2026-10-18' })],
    })
    if (!result.ok) throw new Error('parse failed')
    const plan = planImport({ backup: result.backup, existingHabits: [], existingEntries: [] })
    expect(plan.vacationsToAdd).toHaveLength(1)
  })
})
