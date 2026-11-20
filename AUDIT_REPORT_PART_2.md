# Habit Tracker — Pass 1 Audit Report (Part 2 of 4)

**Read-only audit. No repository files were modified, no migrations executed, no build commands run. Git status confirmed clean on `master`.**

---

## C. Habit Detail audit

### C.1 What is wired (confirmed)

`src/pages/HabitDetail.tsx` passes `habitEpochs` (from `useScheduleHistory`) into:
- `scoreSeries(habit, entries, start, today, vacations, habitEpochs)` → score chart (30d/90d)
- `currentStreak(habit, entries, today, vacations, habitEpochs)` → "Current streak" chip
- `bestStreak(habit, entries, vacations, habitEpochs)` → "Best streak" chip
- `completionRate(habit, entries, addDays(today,-29), today, vacations, habitEpochs)` → "30-day rate"
- `CompletionHistoryChart` (weekly/monthly buckets)
- `Heatmap` (calendar grid)

Vacations are passed to all of the above. `useScheduleHistory` `loading`/`error` are **ignored** — the page renders stats immediately with legacy/empty-epoch semantics and silently switches once epochs load; on fetch error no message is shown and stale epochs may persist. This is a consistency gap vs Performance Review, which surfaces `scheduleLoading`/`scheduleError`.

### C.2 Streaks / score — correct (with caveats)

- `scheduledCurrentStreak` / `scheduledBestStreak` correctly treat weekly_target as one opportunity per closed Mon–Sun week; open/current week is pending, not a failure; transition weeks carry; done-on-unscheduled still wins.
- `scheduledScoreSeries` follows the same rule; the week containing `endDate` is never scored.
- **Unit display gap:** weekly-target streaks count *weeks* but `StatTile` renders just a numeral ("Current streak: 4", "Best streak: 4") with no "weeks" unit. Users may read it as days. Today tile already shows weekly progress as "n/M this week"; Habit Detail streak chips do not.

### C.3 High-severity Habit Detail bug — `completionRate` not weekly-target aware

`score.ts` `completionRate` walks every day and uses `dayStatus` per day. For a weekly_target habit every scheduled day is an eligible opportunity, so a weekly goal of 3/3 shows as 3/30 = 10% over a 30-day window. Streaks and score use week semantics; rate uses day semantics. This is the central Habit Detail weekly-target inconsistency.

Fix direction (Pass 2): make `completionRate` weekly-target aware — one opportunity per closed Mon–Sun week, achieved if done ≥ M; transition/partial/current weeks carry; neutral days excluded; zero eligible → 0. This touches pure `score.ts` and requires new/updated unit tests (tests are allowed here; the constraint is no *silent* changes to score semantics without approval).

### C.4 Heatmap states

- Cells use `dayStatus` with epochs: future = "Not started yet"; skipped = "Skipped"; vacation = "Vacation"; unscheduled = "Off day"; level 0 = "Not completed"; 1–3 = partial traces; 4 = Completed. Neutral cells are outlined transparent, never a 0% miss. ✅
- For weekly_target habits, **every scheduled day is an eligible day**, so empty days in an achieved week still show "Not completed" and count as misses visually. There is no week-level "goal achieved" indicator on the heatmap. Copy says "Not completed" rather than "No check-in" — acceptable for a check-in calendar, but misleading for weekly targets.
- Legend merges Off day / Vacation / Skipped into one swatch ("Off day / Vacation / Skipped"), though cells distinguish them via `statusText`. Minor legend granularity gap.
- Grid is Sun–Sat; weekly-target weeks run Mon–Sun. Visual week grouping doesn't match schedule semantics for weekly targets.

### C.5 CompletionHistoryChart bugs

- **Weekly buckets use Sunday start** (`lastSunday` = Sunday of today's week) for all habits, including weekly_target. For weekly_target it then `resolveEpoch(epochs, start)` on a Sunday and walks Sunday–Saturday — a Mon–Sun week boundary mismatch.
- **Current-epoch gating for all buckets:** `isWeeklyTarget` is decided from `resolveEpoch(epochs, today)` and applied to all 8 historical buckets. A habit that switched daily→weekly_target treats earlier daily weeks as neutral (0/0); a habit that switched weekly_target→daily treats earlier weekly weeks as daily (counts each day). History under past schedules is misrepresented.
- **Current week treated as failure:** if the current Mon–Sun week isn't yet achieved, bucket pushes `count: 0, total: 1` (a red/failure bar) instead of carrying it as pending/neutral. The scoring law explicitly carries the current week.
- **Monthly branch:** `start.toISOString().slice(0,10)` and `end.toISOString().slice(0,10)` shift dates by one day in Asia/Kolkata (local midnight → previous day 18:30Z). Also the daily loop uses `new Date(y, m, d + 1).toISOString().slice(0,10)` — same UTC shift. Violates the dates.ts rule (never `toISOString().slice(0,10)`).
- **Monthly boundary weeks dropped:** weekly_target counts only full Mon–Sun weeks inside the month; partial first/last weeks carry (correct per scoring law) but chart bars show only achieved/total with no pending indication.
- Empty-state `entries.length === 0` shows "No check-ins yet" even for a weekly_target habit with a current open week — acceptable, but no week-progress summary.

### C.6 Skipped / vacation / unscheduled / historical schedule changes

- Skipped rows: `entries.status='skipped'`, value 0; never done; neutral; excluded from denominator. Tap-cycles empty→done→skipped; undo-skip deletes row. ✅
- Vacation: passed into all calcs; done-on-vacation still wins and extends streak; neutral otherwise. ✅ (Vacation UI itself is a separate feature; wiring present here.)
- Before-start days: excluded from timeline via `habit.created_at` clamp. ✅
- Historical schedule changes: `scoreSeries`/`currentStreak`/`bestStreak`/`completionRate` resolve epoch per date via `resolveEpoch`, so past periods follow the schedule that governed them. ✅ for score/streaks; ❌ for `completionRate` (daily walk) and CompletionHistoryChart (current-epoch gating).

### C.7 Creation dates

- All calcs clamp at `habit.created_at` (≥ inclusive). No exclusion bug found in `score.ts`/`dayStatus`. CompletionHistoryChart `date < habit.created_at` continue (inclusive-equal fine) — no bug.
- `habit.created_at` is normalized to a logical date in `useHabits`, so string comparison is safe.

### C.8 Approval-required decisions (Habit Detail)

1. Make `completionRate` weekly-target aware (score semantics change; needs tests + approval).
2. Show weekly unit on streak chips ("n weeks") or keep numeral with a tooltip — product decision.
3. Heatmap: keep per-day check-in record, but consider "No check-in" copy + week-goal summary for weekly_target (copy/UX decision).
4. Surface `useScheduleHistory` `loading`/`error` on Habit Detail (safe, low complexity).
5. Fix CompletionHistoryChart per-bucket epoch resolution, Mon–Sun weekly buckets, pending-current-week carry, and `toISOString` date shift (component fixes; no score.ts change).
