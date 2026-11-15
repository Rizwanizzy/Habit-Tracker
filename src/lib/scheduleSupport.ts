import { getSupabase } from './supabase'

/** Stage 3 capability probe — has the v7 scheduling migration been applied?
 *
 *  The frontend must not assume the migration ran: on a pre-migration
 *  database the schedule columns don't exist and the app must behave exactly
 *  as before Stage 3 (plain frequency form, plain INSERT/UPDATE work because
 *  the §7 guards don't exist yet). Probed once per session with a
 *  schedule_type select; a missing-column error means "not migrated" and any
 *  other error is rethrown for the caller to surface. */
let probe: Promise<boolean> | null = null

export function scheduleColumnsAvailable(): Promise<boolean> {
  probe ??= (async () => {
    const { error } = await getSupabase().from('habits').select('schedule_type').limit(1)
    if (!error) return true
    // 42703 = PostgreSQL undefined_column. PGRST200/204 can mean other
    // failures; only treat a PostgREST column error as absent when it names
    // this exact column. Never swallow permission/network errors.
    if (
      error.code === '42703' ||
      (error.code === 'PGRST204' && /schedule_type/i.test(error.message))
    ) {
      return false
    }
    throw error
  })().catch((error) => {
    // A transient network/permission error must not poison the cached probe.
    probe = null
    throw error
  })
  return probe
}
