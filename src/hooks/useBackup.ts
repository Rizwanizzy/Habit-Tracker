import { useCallback, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { extractError } from './useHabits'
import { now } from '../lib/clock'
import { backupFilename, buildBackup, serializeBackup, type BackupRow } from '../lib/backup'

const PAGE_SIZE = 1000 // Supabase returns at most 1000 rows per request

/** Fetch ALL entries, paging with .range(from, from + 999) ordered by date
 *  then habit_id, until a page has fewer than 1000 rows. */
async function fetchAllEntries(sb: ReturnType<typeof getSupabase>): Promise<BackupRow[]> {
  const all: BackupRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('entries')
      .select('*')
      .order('date')
      .order('habit_id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as BackupRow[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

/**
 * One-shot JSON backup export: every habit (including archived), every
 * entry (paged past Supabase's 1000-row cap), the user_settings row and —
 * only when the user asks — the profile row. buildBackup (pure) assembles
 * the document; the download happens client-side via a Blob + <a download>,
 * with the object URL revoked right after.
 *
 * exportBackup resolves to the error message ("" handling: null on success)
 * so the page can show a toast; the state's `error` mirrors it.
 */
export function useBackup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportBackup = useCallback(async (includeProfile: boolean): Promise<string | null> => {
    setBusy(true)
    setError(null)
    try {
      const sb = getSupabase()
      const { data: userData, error: userError } = await sb.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw new Error('You must be signed in')
      const userId = userData.user.id

      const habits = await sb.from('habits').select('*').order('sort_order', { ascending: true })
      if (habits.error) throw habits.error

      const settings = await sb.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
      if (settings.error) throw settings.error

      let profile: { data: BackupRow | null }
      if (includeProfile) {
        const row = await sb.from('profiles').select('*').eq('user_id', userId).maybeSingle()
        if (row.error) throw row.error
        profile = { data: row.data as BackupRow | null }
      } else {
        profile = { data: null }
      }

      const entries = await fetchAllEntries(sb)
      const vacations = await sb
        .from('vacation_periods')
        .select('*')
        .order('start_date')
      if (vacations.error) throw vacations.error
      const backup = buildBackup({
        habits: (habits.data ?? []) as BackupRow[],
        entries,
        settings: (settings.data as BackupRow | null) ?? null,
        profile: profile.data,
        includeProfile,
        vacationPeriods: (vacations.data ?? []) as BackupRow[],
        exportedAt: now().toISOString(),
      })

      const blob = new Blob([serializeBackup(backup)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFilename(now())
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      return null
    } catch (e) {
      const message = extractError(e)
      setError(message)
      return message
    } finally {
      setBusy(false)
    }
  }, [])

  return { exportBackup, busy, error }
}
