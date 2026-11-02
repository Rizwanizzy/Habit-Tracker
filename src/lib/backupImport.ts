import type { BackupRow } from './backup'
import { normalizeEmoji } from './emoji'
import { validatePeriod } from './vacation'

// --- Types ------------------------------------------------------------------

export interface ImportHabit {
  id: string
  name: string
  type: 'boolean' | 'numeric'
  target: number | null
  unit: string | null
  freq_times: number
  freq_days: number
  color: string
  emoji: string | null
  sort_order: number
  archived: boolean
  created_at: string
}

export interface ImportEntry {
  habit_id: string
  date: string
  value: number
  status: 'done' | 'skipped'
}

/** A vacation_periods row to restore (user_id never survives parsing). */
export interface ImportVacation {
  id: string
  /** Local YYYY-MM-DD. */
  start_date: string
  /** Local YYYY-MM-DD, or null while ongoing. */
  end_date: string | null
  created_at?: string
}

/** The app's existing vacation_periods, reduced to planning keys. */
export interface ExistingVacation {
  id: string
  start_date: string
  end_date: string | null
}

export interface ParsedBackup {
  exportedAt: string
  habits: ImportHabit[]
  entries: ImportEntry[]
  settings: BackupRow
  profile?: BackupRow
  /** Empty when the file has no vacationPeriods key (older exports). */
  vacationPeriods: ImportVacation[]
}

export type ParseResult =
  | { ok: true; backup: ParsedBackup; warnings: string[] }
  | { ok: false; errors: string[] }

export interface ExistingHabit {
  id: string
  name: string
  created_at: string
  sort_order: number
}

export interface ExistingEntry {
  habit_id: string
  date: string
}

export interface ImportPlan {
  /** New habits, with sort_order = max(existing) + backup rank. */
  habitsToCreate: ImportHabit[]
  /** Backup habit id → the id entries must use (matched → existing id; new → own id). */
  habitIdMap: Record<string, string>
  /** Matched (already in the app) backup habit ids. */
  matchedHabitIds: string[]
  entriesToAdd: ImportEntry[]
  /** Count only — existing entries are never touched (import is additive). */
  entriesExistingCount: number
  /** New vacation periods to create (kept default: existing rows untouched). */
  vacationsToAdd: ImportVacation[]
  counts: {
    habitsNew: number
    habitsExisting: number
    entriesNew: number
    entriesExisting: number
    vacationsNew: number
    vacationsExisting: number
  }
  firstDate: string | null
  lastDate: string | null
  hasSettings: boolean
  hasProfile: boolean
  warnings: string[]
}

/** Highest schemaVersion this import knows how to read. */
const SUPPORTED_SCHEMA_VERSION = 1

const MAX_FILE_BYTES = 20 * 1024 * 1024

// --- Row validation (whitelists; unknown keys are always ignored) -----------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

/** A real calendar date: components must round-trip (rejects 2026-02-30). */
function isCalendarDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && ISO_TS_RE.test(v) && !Number.isNaN(Date.parse(v))
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

function validHabit(row: BackupRow): ImportHabit | null {
  const id = row.id
  const name = row.name
  const type = row.type
  const target = row.target
  const unit = row.unit
  const freq_times = row.freq_times
  const freq_days = row.freq_days
  const color = row.color
  const created_at = row.created_at
  const emoji = row.emoji
  if (!isUuid(id)) return null
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200) return null
  if (type !== 'boolean' && type !== 'numeric') return null
  if (target !== null && !isFiniteNumber(target)) return null
  if (unit !== null && typeof unit !== 'string') return null
  if (!isPositiveInt(freq_times) || !isPositiveInt(freq_days)) return null
  if (typeof color !== 'string' || !COLOR_RE.test(color)) return null
  if (emoji !== undefined && emoji !== null && typeof emoji !== 'string') return null
  if (!isIsoTimestamp(created_at)) return null
  return {
    id,
    name: name.trim(),
    type,
    target,
    unit: typeof unit === 'string' && unit.trim() === '' ? null : unit,
    freq_times,
    freq_days,
    color: color.toLowerCase(),
    // Older backups have no emoji column — absent means "no emoji".
    emoji: normalizeEmoji(typeof emoji === 'string' ? emoji : null),
    sort_order: Number.isInteger(row.sort_order) ? (row.sort_order as number) : 0,
    archived: row.archived === true,
    created_at,
  }
}

function validEntry(row: BackupRow): ImportEntry | null {
  if (typeof row.habit_id !== 'string' || row.habit_id.length === 0) return null
  if (!isCalendarDate(row.date)) return null
  if (!isFiniteNumber(row.value)) return null
  // Missing status tolerates backups made before the column existed.
  if (row.status !== undefined && row.status !== 'done' && row.status !== 'skipped') return null
  return {
    habit_id: row.habit_id,
    date: row.date,
    value: row.value,
    status: row.status === 'skipped' ? 'skipped' : 'done',
  }
}

function validVacation(row: BackupRow): ImportVacation | null {
  if (!isUuid(row.id) || !isCalendarDate(row.start_date)) return null
  if (row.end_date !== null && !isCalendarDate(row.end_date)) return null
  const period: ImportVacation = {
    id: row.id,
    start_date: row.start_date,
    end_date: row.end_date === null ? null : (row.end_date as string),
  }
  if (isIsoTimestamp(row.created_at)) period.created_at = row.created_at
  return period
}

/** The UTC/logical date part of either an ISO timestamp or a plain date
 *  string — used to compare created_at granularity-insensitively. */
function datePart(s: string): string {
  return s.slice(0, 10)
}

// --- parseBackup ------------------------------------------------------------

/** Parse + validate a backup document. Invalid JSON, a wrong `app`, a
 *  schemaVersion newer than supported, or a broken top-level shape →
 *  `{ ok: false, errors }`. Otherwise every row runs through a whitelist
 *  (user_id and all unknown keys ignored); invalid rows are dropped with
 *  counted warnings. Duplicate (habit_id, date) entries: last one wins.
 *  Entries referencing a habit not in the file are dropped with a warning.
 *  An optional `vacationPeriods` key (additive in schemaVersion 1) is parsed
 *  through the same whitelist; its end-before-start / overlap checks happen
 *  in planImport against the LIVE rows, not here. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['This file is not a habit-tracker backup.'] }
  }
  const doc = raw as Record<string, unknown>
  if (doc.app !== 'habit-tracker') {
    return { ok: false, errors: ['This file is not a habit-tracker backup.'] }
  }
  const version = doc.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, errors: ['The backup has no valid schemaVersion.'] }
  }
  if (version > SUPPORTED_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `This backup was made by a newer app version (schema ${version}; supported up to ${SUPPORTED_SCHEMA_VERSION}). Update the app first.`,
      ],
    }
  }
  if (!Array.isArray(doc.habits) || !Array.isArray(doc.entries)) {
    return { ok: false, errors: ['The backup has no habits/entries lists.'] }
  }

  const warnings: string[] = []

  // Vacation periods: additive + optional; invalid rows drop with a warning.
  const vacationPeriods: ImportVacation[] = []
  if (doc.vacationPeriods !== undefined) {
    if (Array.isArray(doc.vacationPeriods)) {
      const seenVacationIds = new Set<string>()
      let invalidVacations = 0
      for (const row of doc.vacationPeriods) {
        if (typeof row !== 'object' || row === null) {
          invalidVacations++
          continue
        }
        const period = validVacation(row as BackupRow)
        if (!period) {
          invalidVacations++
          continue
        }
        if (seenVacationIds.has(period.id)) {
          invalidVacations++
          continue
        }
        seenVacationIds.add(period.id)
        vacationPeriods.push(period)
      }
      if (invalidVacations > 0)
        warnings.push(
          `${invalidVacations} invalid break row${invalidVacations === 1 ? '' : 's'} dropped.`,
        )
    } else {
      warnings.push('The vacationPeriods key was skipped (wrong shape).')
    }
  }

  const habits: ImportHabit[] = []
  const habitIds = new Set<string>()
  const seenHabitIds = new Set<string>()
  let invalidHabits = 0
  for (const row of doc.habits) {
    if (typeof row !== 'object' || row === null) {
      invalidHabits++
      continue
    }
    const habit = validHabit(row as BackupRow)
    if (!habit) {
      invalidHabits++
      continue
    }
    // Duplicate id inside the file: keep the first occurrence, warn once below.
    if (seenHabitIds.has(habit.id)) {
      invalidHabits++
      continue
    }
    seenHabitIds.add(habit.id)
    habits.push(habit)
    habitIds.add(habit.id)
  }
  if (invalidHabits > 0) warnings.push(`${invalidHabits} invalid habit row${invalidHabits === 1 ? '' : 's'} dropped.`)

  // Entries: whitelist, then last-one-wins dedupe by (habit_id, date), then
  // drop rows whose habit never appears in the file.
  const byKey = new Map<string, ImportEntry>()
  let invalidEntries = 0
  let unknownRefs = 0
  for (const row of doc.entries) {
    if (typeof row !== 'object' || row === null) {
      invalidEntries++
      continue
    }
    const entry = validEntry(row as BackupRow)
    if (!entry) {
      invalidEntries++
      continue
    }
    if (!habitIds.has(entry.habit_id)) {
      unknownRefs++
      continue
    }
    byKey.set(`${entry.habit_id}|${entry.date}`, entry)
  }
  if (invalidEntries > 0)
    warnings.push(`${invalidEntries} invalid entr${invalidEntries === 1 ? 'y' : 'ies'} dropped.`)
  if (unknownRefs > 0)
    warnings.push(`${unknownRefs} entr${unknownRefs === 1 ? 'y' : 'ies'} dropped (habit not in the file).`)
  const entries = [...byKey.values()]

  return {
    ok: true,
    warnings,
    backup: {
      exportedAt: typeof doc.exportedAt === 'string' ? doc.exportedAt : '',
      habits,
      entries,
      settings: typeof doc.settings === 'object' && doc.settings !== null && !Array.isArray(doc.settings)
        ? (doc.settings as BackupRow)
        : {},
      profile:
        typeof doc.profile === 'object' && doc.profile !== null && !Array.isArray(doc.profile)
          ? (doc.profile as BackupRow)
          : undefined,
      vacationPeriods,
    },
  }
}

// --- planImport -------------------------------------------------------------

/** Build the import plan: match backup habits to existing ones (by id first,
 *  else by case-insensitive name + created_at date), keep the original id on
 *  new habits, assign sort_order = max(existing) + backup rank (so relative
 *  order survives and existing habits don't move), and partition entries by
 *  (mapped habit id, date). Pure; never proposes a delete or overwrite. */
export function planImport(args: {
  backup: ParsedBackup
  existingHabits: ExistingHabit[]
  existingEntries: ExistingEntry[]
  /** vacation_periods rows already in the app (planning keys only). */
  existingVacations?: ExistingVacation[]
  /** Warnings from parseBackup, passed through into the plan. */
  warnings?: string[]
}): ImportPlan {
  const { backup, existingHabits, existingEntries } = args
  const warnings = [...(args.warnings ?? [])]

  const maxSort = existingHabits.reduce((max, h) => Math.max(max, h.sort_order), 0)
  const byId = new Map(existingHabits.map((h) => [h.id, h]))
  const matched = new Set<string>()
  const habitIdMap: Record<string, string> = {}
  const matchedHabitIds: string[] = []
  const habitsToCreate: ImportHabit[] = []
  let rank = 0

  for (const habit of backup.habits) {
    const byIdHit = byId.get(habit.id)
    let existing = byIdHit
    if (!existing) {
      const wanted = habit.name.toLowerCase()
      existing = existingHabits.find(
        (h) =>
          !matched.has(h.id) &&
          h.name.toLowerCase() === wanted &&
          datePart(h.created_at) === datePart(habit.created_at),
      )
    }
    if (existing) {
      matched.add(existing.id)
      habitIdMap[habit.id] = existing.id
      matchedHabitIds.push(existing.id)
    } else {
      rank++
      const created: ImportHabit = { ...habit, sort_order: maxSort + rank }
      habitsToCreate.push(created)
      habitIdMap[habit.id] = habit.id
    }
  }

  const existingKeys = new Set(existingEntries.map((e) => `${e.habit_id}|${e.date}`))
  const entriesToAdd: ImportEntry[] = []
  let entriesExistingCount = 0
  for (const entry of backup.entries) {
    const mappedId = habitIdMap[entry.habit_id]
    if (mappedId == null) continue // cannot happen (parse guarantees refs)
    const mapped = { ...entry, habit_id: mappedId }
    if (existingKeys.has(`${mappedId}|${entry.date}`)) entriesExistingCount++
    else entriesToAdd.push(mapped)
  }

  const dates = backup.entries.map((e) => e.date)
  const hasSettings = Number.isInteger((backup.settings as BackupRow).day_start_hour)

  // Vacation periods: restore a backup period only when the app has no row
  // with the same id AND no row with the same (start_date, end_date) pair —
  // importing the same file again therefore plans nothing. Candidates that
  // would overlap an existing/app-accepted break are dropped with a warning;
  // anything already matching counts as "existing", never touched.
  const existingVacations = args.existingVacations ?? []
  const existingVacationIds = new Set(existingVacations.map((p) => p.id))
  const pairOf = (p: { start_date: string; end_date: string | null }): string => `${p.start_date}|${p.end_date}`
  const existingVacationPairs = new Set(existingVacations.map(pairOf))
  const validationSet: { id: string; start_date: string; end_date: string | null }[] = [...existingVacations]
  const vacationsToAdd: ImportVacation[] = []
  let vacationsExisting = 0
  let vacationsDropped = 0
  for (const period of backup.vacationPeriods ?? []) {
    if (existingVacationIds.has(period.id) || existingVacationPairs.has(pairOf(period))) {
      vacationsExisting++
      continue
    }
    if (validatePeriod(validationSet, period).length > 0) {
      vacationsDropped++
      continue
    }
    vacationsToAdd.push(period)
    validationSet.push(period)
    existingVacationPairs.add(pairOf(period))
  }
  if (vacationsDropped > 0)
    warnings.push(
      `${vacationsDropped} break${vacationsDropped === 1 ? '' : 's'} not restored (overlaps existing breaks).`,
    )

  return {
    habitsToCreate,
    habitIdMap,
    matchedHabitIds,
    entriesToAdd,
    entriesExistingCount,
    vacationsToAdd,
    counts: {
      habitsNew: habitsToCreate.length,
      habitsExisting: matchedHabitIds.length,
      entriesNew: entriesToAdd.length,
      entriesExisting: entriesExistingCount,
      vacationsNew: vacationsToAdd.length,
      vacationsExisting,
    },
    firstDate: dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null,
    lastDate: dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    hasSettings,
    hasProfile: backup.profile !== undefined,
    warnings,
  }
}

export { MAX_FILE_BYTES as maxBackupFileBytes, SUPPORTED_SCHEMA_VERSION }
