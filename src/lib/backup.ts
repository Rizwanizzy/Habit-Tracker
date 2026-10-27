import { toLocalDateString } from './dates'

// Rows are generic records so columns added by later migrations export
// automatically — buildBackup never names data columns, only fields it strips.
export type BackupRow = Record<string, unknown>

export interface BackupPayload {
  app: string
  schemaVersion: number
  exportedAt: string
  timezone: string
  habits: BackupRow[]
  entries: BackupRow[]
  settings: BackupRow
  profile?: BackupRow
  /** Additive in schemaVersion 1: omitted when the user has no breaks. */
  vacationPeriods?: BackupRow[]
}

export interface BackupInput {
  habits: BackupRow[]
  entries: BackupRow[]
  /** The user_settings row, or null when the row does not exist yet. */
  settings: BackupRow | null
  profile?: BackupRow | null
  includeProfile: boolean
  /** vacation_periods rows (may be empty — the key is then left out). */
  vacationPeriods?: BackupRow[]
  /** The export instant in ISO form (passed in so this stays clock-agnostic). */
  exportedAt: string
}

/** Fields never written to a backup: the owning account (each row belongs to
 *  the user making it) and, on the profile, anything identity- or photo-
 *  related (avatar lives in the avatars bucket; email is auth data). */
const PROFILE_DROP_FIELDS: ReadonlySet<string> = new Set(['user_id', 'avatar_path', 'email'])

/** All rows carry user_id (RLS scoping); drop just that one field and spread
 *  everything else so future columns ride along. */
function stripUserId(row: BackupRow): BackupRow {
  const { user_id: _user_id, ...rest } = row
  return rest
}

function sanitizeProfile(profile: BackupRow): BackupRow {
  return stripUserId(Object.fromEntries(Object.entries(profile).filter(([key]) => !PROFILE_DROP_FIELDS.has(key))))
}

/** Assemble the backup document. Includes EVERY habit (archived too) and
 *  EVERY entry; settings becomes {} when the row does not exist yet; profile
 *  is only embedded when explicitly requested. */
export function buildBackup(input: BackupInput): BackupPayload {
  const payload: BackupPayload = {
    app: 'habit-tracker',
    schemaVersion: 1,
    exportedAt: input.exportedAt,
    timezone: 'Asia/Kolkata',
    habits: input.habits.map(stripUserId),
    entries: input.entries.map(stripUserId),
    settings: input.settings ? stripUserId(input.settings) : {},
  }
  if (input.includeProfile && input.profile) {
    payload.profile = sanitizeProfile(input.profile)
  }
  if (input.vacationPeriods && input.vacationPeriods.length > 0) {
    payload.vacationPeriods = input.vacationPeriods.map(stripUserId)
  }
  return payload
}

/** "habit-tracker-backup-YYYY-MM-DD.json" — local calendar date via the
 *  dates.ts helper (never toISOString().slice(0,10)). */
export function backupFilename(date: Date): string {
  return `habit-tracker-backup-${toLocalDateString(date)}.json`
}

/** Pretty-printed JSON for the download blob. */
export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2)
}
