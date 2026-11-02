import { useCallback, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { useHabitsContext } from '../contexts/HabitsContext'
import { extractError } from './useHabits'
import { isDayStartHour } from '../lib/dates'
import { isGender } from '../lib/profile'
import {
  maxBackupFileBytes,
  parseBackup,
  planImport,
  type ImportEntry,
  type ImportPlan,
  type ImportVacation,
  type ParsedBackup,
} from '../lib/backupImport'
import type { BackupRow } from '../lib/backup'

export interface ImportPreview {
  fileName: string
  plan: ImportPlan
  /** The parsed backup — runs need its raw settings/profile rows. */
  backup: ParsedBackup
  /** The user already has a user_settings row (seeds the settings default). */
  hasSettingsRow: boolean
}

export interface ImportOptions {
  /** Entries policy: false (default) = keep what's in the app; true = overwrite with the backup. */
  overwrite: boolean
  restoreSettings: boolean
  restoreProfile: boolean
}

export interface ImportRunResult {
  habitsCreated: number
  habitsFailed: number
  entriesAdded: number
  vacationsAdded: number
}

export interface ImportProgress {
  phase: 'habits' | 'vacations' | 'entries'
  done: number
  total: number
}

const PAGE = 1000 // Supabase returns at most 1000 rows per request
const CHUNK = 500 // entries per .upsert() batch

/** Fetch ALL entries (paged), habit_id + date only — enough for planning. */
async function fetchAllEntryKeys(
  sb: ReturnType<typeof getSupabase>,
): Promise<{ habit_id: string; date: string }[]> {
  const all: { habit_id: string; date: string }[] = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('entries')
      .select('habit_id, date')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as { habit_id: string; date: string }[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/** Profile fields the import is allowed to restore. Never avatar_path or
 *  email (identity/photo data, per backup.ts): the payload only includes
 *  keys present in the file, so columns missing from it are never nulled. */
const PROFILE_FIELDS = ['full_name', 'date_of_birth', 'gender', 'nationality', 'country', 'address', 'phone'] as const

function profilePayload(userId: string, profile: BackupRow): BackupRow {
  const payload: BackupRow = { user_id: userId }
  for (const field of PROFILE_FIELDS) {
    if (profile[field] !== undefined && profile[field] !== null) {
      payload[field] = field === 'gender' && !isGender(profile[field]) ? 'prefer_not_to_say' : profile[field]
    }
  }
  return payload
}

/** Backup import (ADDITIVE & IDEMPOTENT — never deletes, importing the same
 *  file twice changes nothing the second time): readFile parses + plans, run
 *  creates new habits (original ids, one 23505-retry with a fresh UUID) and
 *  upserts entries in chunks of 500. After finishing, the shared habit list
 *  reloads and an `entries-reload` window event asks every mounted useEntries
 *  hook to refetch. No rollback and no deletes: a failure stops the run,
 *  reports what was imported, and stays safe to re-run. */
export function useImportBackup() {
  const { reload } = useHabitsContext()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Parse + plan. Returns the error message, or null when the preview is ready. */
  const readFile = useCallback(
    async (file: File): Promise<string | null> => {
      setError(null)
      if (file.size > maxBackupFileBytes) {
        const message = 'The file is too large — backups must be under 20 MB.'
        setError(message)
        return message
      }
      try {
        const text = await file.text()
        const parsed = parseBackup(text)
        if (!parsed.ok) {
          const message = parsed.errors.join(' ')
          setError(message)
          return message
        }
        const sb = getSupabase()
        const { data: userData, error: userError } = await sb.auth.getUser()
        if (userError) throw userError
        if (!userData.user) throw new Error('You must be signed in')

        const { data: habits, error: habitsError } = await sb.from('habits').select('*')
        if (habitsError) throw habitsError
        const entryKeys = await fetchAllEntryKeys(sb)
        const { data: vacationRows, error: vacationsError } = await sb
          .from('vacation_periods')
          .select('id, start_date, end_date')
        if (vacationsError) throw vacationsError

        const backup: ParsedBackup = parsed.backup
        const plan = planImport({
          backup,
          existingHabits: ((habits ?? []) as BackupRow[]).map((h) => ({
            id: h.id as string,
            name: h.name as string,
            created_at: h.created_at as string,
            sort_order: (h.sort_order as number) || 0,
          })),
          existingEntries: entryKeys,
          existingVacations: (vacationRows ?? []) as { id: string; start_date: string; end_date: string | null }[],
          warnings: parsed.warnings,
        })

        const settingsRow = await sb.from('user_settings').select('user_id').maybeSingle()
        if (settingsRow.error) throw settingsRow.error

        setPreview({
          fileName: file.name,
          plan,
          backup,
          hasSettingsRow: settingsRow.data != null,
        })
        return null
      } catch (e) {
        const message = extractError(e)
        setError(message)
        return message
      }
    },
    [],
  )

  /** Execute the preview's plan. Returns the counts on success (null on
   *  failure — the error state carries the message and what was imported). */
  const run = useCallback(
    async (preview: ImportPreview, options: ImportOptions): Promise<ImportRunResult | null> => {
      setBusy(true)
      setError(null)
      setProgress(null)
      try {
        const sb = getSupabase()
        const { data: userData, error: userError } = await sb.auth.getUser()
        if (userError) throw userError
        if (!userData.user) throw new Error('You must be signed in')
        const userId = userData.user.id

        const plan = preview.plan
        const result: ImportRunResult = { habitsCreated: 0, habitsFailed: 0, entriesAdded: 0, vacationsAdded: 0 }
        // Runtime habit-id remaps (23505 retries) — folded into the plan's map.
        const idMap: Record<string, string> = { ...plan.habitIdMap }

        // a) Create new habits one at a time, keeping their original id.
        for (const habit of plan.habitsToCreate) {
          const payload = {
            user_id: userId,
            id: habit.id,
            name: habit.name,
            type: habit.type,
            target: habit.target,
            unit: habit.unit,
            freq_times: habit.freq_times,
            freq_days: habit.freq_days,
            color: habit.color,
            emoji: habit.emoji,
            sort_order: habit.sort_order,
            archived: habit.archived,
            created_at: habit.created_at,
          }
          try {
            const { error } = await sb.from('habits').insert(payload)
            if (error) throw error
            idMap[habit.id] = habit.id
            result.habitsCreated++
          } catch (e) {
            // Unique violation: this id already exists under ANOTHER user —
            // retry once with a fresh id and remap this habit's entries.
            const code = (e as { code?: string }).code
            if (code !== '23505' && !String(e).includes('duplicate key')) throw e
            const newId = crypto.randomUUID()
            const { error: retryError } = await sb.from('habits').insert({ ...payload, id: newId })
            if (retryError) {
              result.habitsFailed++
              throw retryError
            }
            idMap[habit.id] = newId
            result.habitsCreated++
          }
        }

        // b) Restore vacation periods (new breaks only; additive + idempotent,
        //    planned exactly like habits: original id, one 23505-retry).
        const vacations: ImportVacation[] = plan.vacationsToAdd
        if (vacations.length > 0) setProgress({ phase: 'vacations', done: 0, total: vacations.length })
        let vacationsDone = 0
        for (const period of vacations) {
          const payload: BackupRow = {
            user_id: userId,
            id: period.id,
            start_date: period.start_date,
            end_date: period.end_date,
          }
          if (period.created_at !== undefined) payload.created_at = period.created_at
          try {
            const { error } = await sb.from('vacation_periods').insert(payload)
            if (error) throw error
            result.vacationsAdded++
          } catch (e) {
            const code = (e as { code?: string }).code
            if (code !== '23505' && !String(e).includes('duplicate key')) throw e
            const { error: retryError } = await sb
              .from('vacation_periods')
              .insert({ ...payload, id: crypto.randomUUID() })
            if (retryError) throw retryError
            result.vacationsAdded++
          }
          vacationsDone++
          setProgress({ phase: 'vacations', done: vacationsDone, total: vacations.length })
        }

        // c) Upsert entries in chunks of 500, onConflict habit_id,date.
        const entries: ImportEntry[] = plan.entriesToAdd.map((e) => ({
          ...e,
          habit_id: idMap[e.habit_id] ?? e.habit_id,
        }))
        setProgress({ phase: 'entries', done: 0, total: entries.length })
        for (let i = 0; i < entries.length; i += CHUNK) {
          const chunk = entries.slice(i, i + CHUNK).map((e) => ({
            user_id: userId,
            habit_id: e.habit_id,
            date: e.date,
            value: e.value,
            status: e.status,
          }))
          const { error } = await sb.from('entries').upsert(chunk, {
            onConflict: 'habit_id,date',
            // Default "Keep what's already in the app": ignore duplicates.
            ignoreDuplicates: !options.overwrite,
          })
          if (error) throw error
          result.entriesAdded += chunk.length
          setProgress({ phase: 'entries', done: Math.min(i + CHUNK, entries.length), total: entries.length })
        }

        // d) Optional settings restore: only day_start_hour, valid values
        //    only (invalid never reaches the DB); the payload deliberately
        //    omits everything else so columns can never be nulled.
        if (options.restoreSettings && plan.hasSettings) {
          const hour = preview.backup.settings.day_start_hour
          if (isDayStartHour(hour)) {
            const { error } = await sb
              .from('user_settings')
              .upsert({ user_id: userId, day_start_hour: hour }, { onConflict: 'user_id' })
            if (error) throw error
          }
        }

        // e) Optional profile restore: only the whitelisted fields that are
        //    actually present in the file (never avatar_path/email).
        if (options.restoreProfile && plan.hasProfile) {
          const { error } = await sb
            .from('profiles')
            .upsert(profilePayload(userId, preview.backup.profile as BackupRow), { onConflict: 'user_id' })
          if (error) throw error
        }

        // Refresh every page: shared habit list + mounted useEntries hooks.
        await reload()
        window.dispatchEvent(new Event('entries-reload'))
        return result
      } catch (e) {
        const message = extractError(e)
        // Report what was imported so far; safe to re-run (additive).
        setError(message + ' — everything imported up to this point has been kept; importing the same file again is safe.')
        return null
      } finally {
        setBusy(false)
        setProgress(null)
      }
    },
    [reload],
  )

  function closePreview() {
    setPreview(null)
    setError(null)
  }

  return { preview, readFile, run, closePreview, busy, progress, error }
}
