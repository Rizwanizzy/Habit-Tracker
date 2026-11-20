# Habit Tracker — Pass 1 Audit Report (Part 4 of 4)

**Read-only audit. No repository files were modified, no migrations executed, no build commands run. Git status confirmed clean on `master`.**

---

## E. Backup / import audit

### E.1 Current backup (schemaVersion 1)

`src/lib/backup.ts` `buildBackup`: `schemaVersion: 1`; exports every habit (including archived), every entry, `user_settings`, optional `profile`, `vacationPeriods`. Habit rows are exported with `SELECT *`, so schedule columns (`schedule_type`, `scheduled_days`, `interval_days`, `weekly_target`, `legacy_freq_times`, `legacy_freq_days`, `emoji`, `created_at`) ride along in JSON. **`habit_schedule_history` is NOT exported.** No `scheduleHistory` key in the payload.

`src/hooks/useBackup.ts`: fetches habits, entries (paged via `fetchAllEntries`, 1000 rows/req), user_settings, profile, vacation_periods. Does NOT fetch `habit_schedule_history`.

### E.2 Import (schemaVersion 1)

`src/lib/backupImport.ts` `parseBackup` / `planImport` / `useImportBackup`:
- Whitelists basic habit fields: id, name, type, target, unit, freq_times, freq_days, color, emoji, created_at. **Schedule columns are ignored.**
- `validEntry` carries `status`; conflicts compared by mapped `(habit_id, date)`.
- Default entry policy: keep what's already in the app; "Overwrite with backup" is an explicit opt-in checkbox. ✅ additive/idempotent for habits and entries.
- Habits restored one-by-one with original id; one 23505 retry with fresh UUID. Entries upserted in chunks of 500 with `onConflict 'habit_id,date'` and `ignoreDuplicates`. Vacations restored after habits with `crypto.randomUUID()`.
- Profile/settings restore only whitelisted fields present in the file; never `email`/`avatar_path`, never nulling.
- On finish: shared habits `reload()` + `entries-reload` window event.

### E.3 What is lost on import of a modern (v7) database

1. **Schedule history is not exported at all.** Imported habits get only basic fields; `schedule_type`/`scheduled_days`/`interval_days`/`weekly_target`/`legacy_freq_*` are dropped.
2. On a v7 target DB, the `habits_normalize_schedule` BEFORE INSERT trigger classifies the imported row:
   - `freq_times=1, freq_days=1` → `schedule_type='daily'`, seed trigger creates one daily epoch at `created_at`.
   - Anything else (weekly_target M/7, weekdays k/7, interval 1/N, custom) → `schedule_type='legacy'` with frozen `legacy_freq_times`/`legacy_freq_days`; seed trigger creates one legacy epoch.
   - **Weekly_target / weekdays / interval / custom schedules all degrade to legacy or daily.** Historical `effective_from` and past schedule changes are unrecoverable from the backup.
3. On a pre-v7 target DB, schedule columns don't exist; later applying the v7 migration re-classifies from the freq mirror — same degradation.
4. Legacy backups (no `scheduleHistory` key): no change; current import behavior preserved. Parser must tolerate an absent key.

### E.4 What is required to restore schedule history

- Add a `scheduleHistory` array to `BackupPayload`/`BackupInput` and export `habit_schedule_history` rows (minus `user_id`), gated on schedule-table availability (`scheduleColumnsAvailable()` or try/catch) so pre-migration DBs export without it.
- Bump `SUPPORTED_SCHEMA_VERSION` from 1 to 2 (or keep v1 additive and document silent loss — bumping is safer so older apps explicitly refuse newer backups).
- **Import restoration cannot write `habit_schedule_history` directly:** the table is SELECT-only for authenticated; `anon` revoked; insert/update/delete revoked for authenticated. The only writer is the SECURITY DEFINER `append_habit_schedule_epoch` RPC, which sets `effective_from` to `now()` (today) — so replaying it cannot preserve historical `effective_from`.
- **A new SECURITY DEFINER RPC (or migration) is required** to insert historical epochs with explicit `effective_from`, owner-checked, validated against the existing constraints, `ON CONFLICT (habit_id, effective_from) DO NOTHING` (additive/idempotent default). New migration file (e.g. `20261117_restore_schedule_history_v7.sql`) plus README/upgrade-list update.
- Plan must remap history rows through the habit `idMap` after the 23505 retry. For matched existing habits, decide: skip history by default (safest, never changes existing habit semantics) or add only missing epochs via `ON CONFLICT DO NOTHING` with preview counts (additive but alters interpretation of existing entries). **This is an approval-required decision.**
- Additive/idempotent behavior preserved: importing the same file twice plans zero new history rows for already-restored habits.

### E.5 Test gaps

- `backup.test.ts`, `backupImport.test.ts` cover habits/entries/vacations/profile/settings but not `scheduleHistory` export/import or `schemaVersion` bump. No test for import into a v7 DB with schedule columns.

### E.6 Approval-required decisions (backup)

1. Bump `SUPPORTED_SCHEMA_VERSION` to 2 and add `scheduleHistory` export/import (requires new RPC/migration).
2. For matched existing habits on import: skip history by default vs add-only-missing-epochs (semantics-altering; needs preview).
3. New restore RPC SQL design and migration filename (needs review before implementation).

---

## F. Production migration audit

### F.1 Migration files and dependency order (confirmed from repo)

1. `supabase/migrations/20261113_schedule_base_v7.sql` — base-only. Transactional (`begin;`/`commit;`). Preflight guard aborts if `habits.schedule_type`, `habit_schedule_history`, or any of `append_habit_schedule_epoch`/`normalize_habit_schedule`/`guard_habit_schedule_columns`/`seed_habit_schedule_history` already exist. Adds 4 habit schedule columns; `habit_schedule_history` table + unique index + RLS (SELECT-only for authenticated, insert/update/delete revoked); 3 constraints (`habits_freq_mirror_ck`, `habits_schedule_shape`, `habit_schedule_history_shape` + `habit_schedule_history_type_ck`); 3 triggers (`habits_normalize_schedule`, `habits_guard_schedule_columns`, `habits_seed_schedule_history`); original 5-arg `append_habit_schedule_epoch` RPC (SECURITY DEFINER, `search_path=public`). Classifies existing 1/1 as daily, everything else as legacy; seeds one initial epoch per habit at logical `created_at` (Asia/Kolkata + day_start_hour). Expected on known production data: daily 22, legacy 2, history 24, entries unchanged.
2. `supabase/migrations/20261114_custom_schedule_rpc.sql` — staging-corrected. Transactional. Replaces the 7-arg RPC (adds `custom` type), replaces 4 constraints by name (custom-aware), adds 2 triggers/functions (`fill_custom_schedule_history_freq`, `ensure_custom_schedule_epoch`) and re-owns SECURITY DEFINER functions to the habits table owner. Depends on 20261113's exact constraint/trigger names.
3. `supabase/migrations/20261115_fix_legacy_same_day_overwrite.sql` — replaces 7-arg RPC body; `search_path=''`; `FOR UPDATE` on habit row; legacy same-day overwrite guard; legacy same-day coalescing unchanged; revokes/grants execute to authenticated only. Depends on 20261114.
4. `supabase/migrations/20261116_atomic_habit_save_v7.sql` — `save_habit_with_schedule_v7` (SECURITY INVOKER, `search_path=''`, row-lock, atomic details + schedule). Transactional. Depends on 20261113–15 and the row-lock/search_path hardening. **Current frontend calls this for every edit when schedule columns exist.**

### F.2 Staging vs production status

- Staging: docs say v7 applied; no explicit confirmation that 20261116 ran.
- Production: **UNVERIFIED**. Docs say base v7 "prepared"; `20261116` is omitted from the README upgrade list and from AGENTS/PROJECT_CONTEXT migration sequences. No authenticated read-only DB access was used in this pass. Production may have 20261113–15 but not 20261116 → if so, the capability probe sees `schedule_type` (capable=true) but every habit edit fails with "function not found" (`save_habit_with_schedule_v7` missing).

### F.3 Capability-probe sufficiency

`scheduleColumnsAvailable()` selects only `habits.schedule_type` and treats a missing-column error as "not migrated". It does **not** verify:
- `habit_schedule_history` table exists and is SELECTable
- the 5 triggers exist
- the 7-arg `append_habit_schedule_epoch` RPC exists and is executable
- `save_habit_with_schedule_v7` exists
- constraints are valid/custom-aware

A partially migrated DB (e.g., columns added but history table missing, or 20261113–15 applied without 20261116) can be misdetected as capable. Frontend then attempts schedule writes that fail. **Strengthen the probe or add a runtime fallback** before relying on it for edits.

### F.4 Rollback / recovery plan (read-only statement only)

- `20261113` is transactional and aborts on pre-existing objects; a failed apply rolls back automatically. After a committed apply, reverting requires a snapshot restore or manual DDL (drop new columns/table/constraints/triggers/functions) after exporting any schedule data — destructive, not part of this audit.
- `20261114`–`20261116` are function/constraint changes; prior versions exist in git but restoring them manually is error-prone. Safest rollback: database snapshot/point-in-time restore.
- `20261113` aborts if any scheduling object exists; recovery from a partial apply requires inspection/manual repair or snapshot restore — no automatic "repair" path.

### F.5 Read-only production verification SQL (for the user to run)

All statements are SELECT-only. Run in the Supabase SQL editor; no credentials are exposed by these queries.

```sql
-- 1. Database context
select current_database() as db, current_user as current_user, version() as pg_version;

-- 2. Schedule columns present?
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'habits'
  and column_name in ('schedule_type','scheduled_days','interval_days','weekly_target')
order by column_name;

-- 3. History table + columns + RLS
select to_regclass('public.habit_schedule_history') as history_table_exists;
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'habit_schedule_history'
order by ordinal_position;
select relname, relrowsecurity, relforcerowsecurity
from pg_class where oid = 'public.habit_schedule_history'::regclass;

-- 4. Grants on history table (expect: authenticated SELECT only; no INSERT/UPDATE/DELETE; anon none)
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'habit_schedule_history'
order by grantee, privilege_type;

-- 5. Policies
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('habits','habit_schedule_history')
order by tablename, policyname;

-- 6. Scheduling functions (expect 7-arg append, save_habit_with_schedule_v7, trigger helpers)
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       p.proconfig as search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'append_habit_schedule_epoch','normalize_habit_schedule','guard_habit_schedule_columns',
    'seed_habit_schedule_history','fill_custom_schedule_history_freq','ensure_custom_schedule_epoch',
    'save_habit_with_schedule_v7'
  )
order by p.proname;

-- 7. Function execute rights (expect authenticated=true, anon=false)
select has_function_privilege('authenticated',
  'public.append_habit_schedule_epoch(uuid,text,smallint,integer,integer,integer,integer)','execute') as append_auth_exec,
       has_function_privilege('anon',
  'public.append_habit_schedule_epoch(uuid,text,smallint,integer,integer,integer,integer)','execute') as append_anon_exec;

-- 8. Triggers (expect 5 on habits/habit_schedule_history)
select t.tgname as trigger_name, c.relname as table_name, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname in ('habits','habit_schedule_history')
order by c.relname, t.tgname;

-- 9. Constraints valid (expect custom-aware definitions)
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition, convalidated
from pg_constraint
where conrelid in ('public.habits'::regclass,'public.habit_schedule_history'::regclass)
  and conname in ('habits_freq_mirror_ck','habits_schedule_shape','habit_schedule_history_shape','habit_schedule_history_type_ck','habit_schedule_history_habit_effective_key')
order by conrelid::regclass::text, conname;

-- 10. Data classification (compare to expected: daily 22, legacy 2; history count; orphan/missing epochs)
select schedule_type, count(*) from public.habits group by 1 order by 1;
select count(*) as history_rows from public.habit_schedule_history;
select count(*) as orphan_history from public.habit_schedule_history h
  left join public.habits hb on hb.id = h.habit_id where hb.id is null;
select h.id, h.name, h.schedule_type from public.habits h
  left join public.habit_schedule_history e on e.habit_id = h.id
  where e.id is null;  -- expect 0: every habit has at least one epoch

-- 11. Migration ledger (optional; may not exist on plain Postgres/Supabase)
select version, name from supabase_migrations.schema_migrations order by version desc limit 10;

-- 12. bit_count availability (PG 14+ needed by constraints)
select bit_count(127::integer::bit(16)) as bit_count_works;
```

### F.6 Approval-required decisions (migrations)

1. Confirm production migration state with the SQL above before any frontend reliance on scheduling.
2. Apply `20261116` to production if missing (it is required by the current frontend).
3. Add `20261116` to the README upgrade list and docs (doc fix only).
4. Strengthen `scheduleColumnsAvailable()` or add fallback/feature detection before enabling schedule edits on production.
5. Rollback = snapshot restore only; no automatic rollback after commit.

---

## G. Implementation plan (Pass 2 — proposed, not implemented)

Order: notifications correctness → Review/Habit Detail bugs → backup schedule history → production migration rollout. Each item lists files, helpers, tests, dependencies, risks, acceptance criteria, complexity.

### G.1 Notification fixes (no DB changes)

**Files:** `worker/src/index.ts`, `src/lib/notifications.ts`, `src/hooks/useNotificationPermission.ts`, `src/components/NotificationCard.tsx`, `src/components/ReminderSettings.tsx`, `public/push-sw.js`.
**Helpers:** `isDue` midnight-wrap; copy alignment; optional `/send-test` caller scoping; denied/unsupported "turn off reminders" path.
**Tests:** new `worker/src/index.test.ts` for `isDue` (wrap boundary 23:45–23:59, 20:00, DST-adjacent); `notifications.test.ts` copy assertions if desired.
**Dependencies:** none.
**Risks:** copy change is low risk; `isDue` fix must keep default 20:00 working; changing click behavior could alter expected "open Today" UX.
**Acceptance:** reminder 23:50 sends at the 00:00-equivalent tick; test copy matches recommended; success line says "shown"; denied users can disable reminder (if approved).
**Complexity:** `isDue` fix Low; copy Low; click/scoping Medium; denied-disable Medium.

### G.2 Review current-period + weekly-target fixes (no DB changes)

**Files:** `src/lib/review.ts` (clamp end to today; `week <= end` for completed periods; overall-score filter; `getCompletedYearRange` baseline decision), `src/components/ReviewHeroCard.tsx`, `src/components/ReviewHabitList.tsx`, `src/components/ReviewBreakdownCard.tsx`.
**Tests:** `review.test.ts` current-month future-day exclusion; weekly Review weekly_target zero/positive; overall score excludes zero-eligible.
**Dependencies:** none.
**Risks:** changing `getCompletedYearRange` baseline changes labels/tests; mixing day/week units in hero card needs labeling.
**Acceptance:** current month/year rates not dragged by future days; weekly Review doesn't falsely zero weekly_target; unit labels correct.
**Complexity:** clamp Low; weekly boundary Medium; unit-label decision Medium.

### G.3 Habit Detail fixes

**Files:** `src/lib/score.ts` (weekly-target `completionRate`), `src/pages/HabitDetail.tsx` (surface schedule loading/error; streak unit), `src/components/CompletionHistoryChart.tsx` (per-bucket epoch, Mon–Sun weekly buckets, pending current week, local date helpers instead of `toISOString`).
**Tests:** `score.test.ts` weekly-target completionRate; `scoreSchedule.test.ts` additions; `completionHistoryChart` unit coverage if extractable.
**Dependencies:** score semantics change needs approval; chart fix is component-level.
**Risks:** changing `completionRate` affects all callers (Habit Detail; possibly Overview/Review if they use it directly — Overview uses `completionSeries`, not `completionRate`).
**Acceptance:** weekly_target 30-day rate reflects achieved weeks (e.g. 4/4 = 100%); chart buckets correct; loading/error shown.
**Complexity:** `completionRate` High (score semantics + tests); chart Medium; HabitDetail loading Low.

### G.4 Backup schedule history (requires DB migration)

**Files:** `src/lib/backup.ts` (`schemaVersion` 2, `scheduleHistory` export), `src/hooks/useBackup.ts` (fetch history), `src/lib/backupImport.ts` (parse/validate/plan history), `src/hooks/useImportBackup.ts` (insert history via new RPC), `src/components/ImportPreviewDialog.tsx` (history counts), new migration `20261117_restore_schedule_history_v7.sql` + new SECURITY DEFINER restore RPC.
**Tests:** backup/import tests for scheduleHistory round-trip; idempotency; v7 import degradation baseline.
**Dependencies:** new RPC migration must exist before import code can write history; schemaVersion bump breaks older apps (explicit error — intended).
**Risks:** history insertion alters existing-habit semantics if applied to matched habits; RPC design must match existing constraints/owners.
**Acceptance:** fresh import restores full schedule history for new habits; re-import plans zero new history; modern schedules no longer degrade to legacy/daily.
**Complexity:** High (new RPC + migration + import planning + tests).

### G.5 Production migration rollout

**Files:** `README.md` (add `20261116` to upgrade list), `src/lib/scheduleSupport.ts` (strengthen probe), docs (AGENTS.md/PROJECT_CONTEXT drift — sync recorded status to actual code state).
**Tests:** migration verification SQL (user-run); no repo test changes.
**Dependencies:** production DB access; staging dry-run first.
**Risks:** partial migration misdetection; `20261116` missing breaks edits.
**Acceptance:** production has all four migrations applied; probe accurately reflects capability; docs consistent.
**Complexity:** Medium (operational, not code).

---

## H. Approval-required decisions (consolidated)

| # | Area | Decision needed |
|---|------|-----------------|
| H1 | Notifications | Change production body to recommended copy; align local test copy and success line |
| H2 | Notifications | Fix `isDue` midnight wrap (high severity) |
| H3 | Notifications | Scope `/send-test` to caller by default; add last-sent dedupe guard |
| H4 | Notifications | Allow denied/unsupported users to disable an existing server reminder in-app |
| H5 | Review | Clamp current monthly/yearly calculation end to `min(period.end, today)` |
| H6 | Review | Weekly Review treatment of weekly_target (exclude from day rate + separate week progress vs mixed units) — do not silently unify |
| H7 | Review | `week <= end` for closed final week in completed periods (confirm intended semantics) |
| H8 | Review | `overallScore` average only over `eligible>0` habits |
| H9 | Review | `getCompletedYearRange` baseline: completed year vs current year |
| H10 | Habit Detail | Make `completionRate` weekly-target aware (score semantics change; needs tests) |
| H11 | Habit Detail | Weekly unit on streak chips; heatmap copy/week-goal summary for weekly_target |
| H12 | Backup | Bump `SUPPORTED_SCHEMA_VERSION` to 2 + `scheduleHistory` export/import |
| H13 | Backup | Matched-existing-habit history: skip by default vs add-only-missing-epochs |
| H14 | Backup | Design/review new restore RPC migration |
| H15 | Migrations | Confirm production state via read-only SQL; apply `20261116` if missing; add to README |
| H16 | Migrations | Strengthen `scheduleColumnsAvailable()` probe or add fallback |

---

## I. Git status confirmation

- Working directory: `S:\The begining\VS code\Habit-Tracker`
- Branch: `master` (clean)
- `git status --porcelain=v1`: empty (no changes)
- `git diff --stat`: empty
- Recent commits: `914e0ec`, `b46ed21`, `c45bba3` (all prior, unrelated to this audit)
- No files were created, modified, formatted, generated, or deleted by this audit except the four `AUDIT_REPORT_PART_*.md` report files in the repo root (these are report artifacts, not source changes; they may be removed after review).
- No build commands (`npm run build`, `npm test`) were run, per read-only constraint. Test counts were not re-verified.
- No migrations executed; no DB rows modified; no secrets/credentials read or exposed.

**Pass 1 is complete. Waiting for explicit Pass 2 approval before any implementation.**
