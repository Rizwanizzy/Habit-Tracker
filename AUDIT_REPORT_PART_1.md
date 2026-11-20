# Habit Tracker — Pass 1 Audit Report (Part 1 of 4)

**Status:** Strictly read-only audit. No repository files were modified, no migrations executed, no build commands run. Git status confirmed clean on `master`.

**Environment:** `S:\The begining\VS code\Habit-Tracker`. Branch `master`. Latest commits: `914e0ec` (iOS Matrix fix), `b46ed21` (Today Matrix skip popup + reordering), `c45bba3` (Today UI 2.0 sign-off).

**Working tree:** clean (`git status --porcelain=v1` empty; `git diff --stat` empty).

---

## A. Executive summary

This is Pass 1 of a planned two-pass effort. The goal is a strictly read-only audit of Web Push reminders, Habit Detail schedule-history integration, Performance Review schedule awareness, backup/import schedule history, production scheduling migrations, and cross-feature consistency. Pass 2 implementation begins only after explicit approval.

### Confirmed facts

- The four scheduling migration files exist and are dependency-ordered:
  `20261113_schedule_base_v7.sql` → `20261114_custom_schedule_rpc.sql` → `20261115_fix_legacy_same_day_overwrite.sql` → `20261116_atomic_habit_save_v7.sql`.
- Frontend already wires schedule epochs into Habit Detail (`scoreSeries`, `currentStreak`, `bestStreak`, `completionRate`, `CompletionHistoryChart`, `Heatmap`) and into Performance Review (`habitOpportunities`, monthly/yearly breakdowns). Stage 4 wiring is partially present, not pending as docs claim.
- `supabase/schema.sql` does NOT contain scheduling objects; a fresh bootstrap from `schema.sql` alone stays pre-scheduling.
- Git status is clean. No destructive commands were run. No credentials were read or exposed.
- Production DB state is **UNVERIFIED** — no authenticated read-only DB access was used in this pass.

### Top findings (high severity)

1. **Worker reminder-time midnight wrap bug** (`worker/src/index.ts` `isDue`): minute-of-day comparison without wrap means reminder times 23:46–23:59 are never sent (the 23:45 tick precedes them and the 00:00 tick wraps to 0). Default 20:00 is unaffected.
2. **Review current-period future-day counting** (`review.ts` `habitOpportunities` / `scoreRange`): `isNeutral` excludes `future`, so current monthly/yearly Review windows count remaining future days/months as missed, dragging rates/score down. Weekly offset-0 is clamped to today; monthly/yearly offset-0 are not.
3. **`completionRate` is not weekly-target aware** (`score.ts`): Habit Detail 30-day rate counts every day as eligible for a weekly-target habit (e.g. 3 done / 30 days = 10%), while weekly streaks/score count weeks. This is the core Habit Detail weekly-target inconsistency.
4. **`20261116_atomic_habit_save_v7.sql` omitted from README upgrade list** and docs; current frontend calls `save_habit_with_schedule_v7` for every edit when schedule columns exist. If production lacks 20261116, edits fail with "function not found".
5. **Capability probe `scheduleColumnsAvailable()` checks only `schedule_type`** — it does not verify the history table, triggers, 7-arg RPC, or `save_habit_with_schedule_v7`. A partially migrated DB can be misdetected as capable.
6. **Backup export/import lacks `habit_schedule_history`**: modern schedules (weekly_target/weekdays/interval/custom) are lost on import; on a v7 DB they degrade to legacy/daily; historical `effective_from` cannot be preserved without a new restore RPC.
7. **Review week-based unit inconsistency**: `weekBased` only true for pure weekly; mixed-mode habits display count as "days" even when weeks are counted; weekly Review (Sun–Sat) contains no complete Mon–Sun week, so weekly-target habits contribute zero weekly opportunities.
8. **Send test is local-only, not end-to-end**: UI "Send test" uses `sendLocalTestNotification` (browser Notification API / SW `showNotification`), not the Worker `/send-test`. It proves display only, not remote push delivery. Success message says "Test notification sent!" which overstates.
9. **Denied/unsupported permission hides ReminderSettings** — a user with an existing enabled server reminder cannot turn it off in-app when permission is denied or Web Push unsupported.
10. **Documentation drift**: PROJECT_CONTEXT Stage 1/2 say "DB migration pending"; README upgrade list omits `20261116`; PROJECT_CONTEXT roadmap says HabitDetail/Review epoch wiring pending though code is wired; `getCompletedYearRange` comment says completed year but code/tests use current year.

---

## B. Notification audit

### B.1 Production scheduled path (Worker, remote push)

**Trace:** Cloudflare Worker `worker/src/index.ts` cron `*/15 * * * *` → `sendDueReminders` → `sendReminders` → queries `notification_settings` (`reminder_enabled=eq.true`) → per user computes local `hh:mm` in `s.timezone` → `isDue` → queries `push_subscriptions` → `fetch(sub.endpoint, ...)` with VAPID Authorization + RFC 8291 `aes128gcm` body → on `404`/`410` deletes dead endpoint; other non-ok logged as `failed`.

- **Title:** `Habit Tracker`
- **Body:** `Time to check in on your habits for today!`
- **Tag:** `daily-reminder`
- **Renotify:** `true`
- **URL/data:** `/`
- **Icon:** `/icon-192.png` (SW default)
- **Badge:** `/pwa-64x64.png` (SW default)
- **Date:** not set (unused by click handler)
- **TTL/Urgency:** `60` / `normal`
- **Subject:** hardcoded `SUBJECT = 'mailto:reminders@habbits-tracker.pages.dev'`; `env.VAPID_SUBJECT` is declared but **ignored**.
- **Success signal:** `sent`/`gone`/`failed` counts only. No per-user last-sent guard, no delivery receipt, no dedupe. Overlapping cron ticks, retries, and manual `/send-test` can send duplicates.
- **Time/timezone:** per-user `notification_settings.timezone` default `Asia/Kolkata`; never updated from browser timezone; no UI timezone control. Fallback `DEFAULT_TZ = 'Asia/Kolkata'`. Cron runs in UTC; per-user local conversion is client-side-aware in the Worker.
- **DST/repeat-hour risk:** `isDue` has no date awareness; a repeated local hour in DST fall-back can send twice. (Not relevant for IST, but relevant if timezone is ever changed.)
- **Disabled/removed devices:** `reminder_enabled=false` excludes the user. Removed device rows are deleted locally + from DB. Worker cleans `404`/`410` endpoints; other errors are not cleaned. `last_seen_at` is never updated, so stale devices cannot be identified or remotely removed from another device.

### B.2 Critical production bug — `isDue` midnight wrap

`isDue(nowHHMM, reminderHHMM)` returns `now >= due && now < due + WINDOW_MINUTES` with no wrap. Cron ticks at `:00,:15,:30,:45`.

- Reminder `23:45` → tick `23:45` matches (`1425 >= 1425 && < 1440`). OK.
- Reminder `23:46`–`23:59` → tick `23:45` is before due; tick `00:00` wraps to `0`, which is not `>= 1426`–`1439`. **Never sent.**
- Every subsequent day repeats the same miss. Default `20:00` works.
- Fix: wrap when `due + WINDOW_MINUTES > 1440` (match `now >= due || now < (due + WINDOW_MINUTES - 1440)`). Requires tests (none exist for `isDue`).

### B.3 Manual Send test path (local display only)

**Trace:** `NotificationCard.handleSendTest` → `useNotificationPermission.sendTest` → `sendLocalTestNotification('Habit Tracker Reminder', { body: 'Time to check in on your habits today! (Test Notification)' })` → prefers `serviceWorker.getRegistration().showNotification` (Path A), falls back to `new Notification` (Path B).

- **Title:** `Habit Tracker Reminder`
- **Body:** `Time to check in on your habits today! (Test Notification)` plus default `Notifications are working! You will receive daily habit reminders.` (overridden by caller)
- **Tag:** `test-notification`
- **Icon:** `/icon-192.png`; **Badge:** `/pwa-64x64.png`; **Renotify:** `true`
- **URL/data:** none set on the constructor options; SW click handler defaults to `/`; `new Notification()` on desktop is not routed through the SW `notificationclick` handler.
- **Success signal:** `ok:true` means the browser *displayed* the notification locally. It does **not** call Worker `/send-test`, does not prove remote push, and does not verify VAPID/subscription/encryption.
- **Copy leakage:** body contains `(Test Notification)` — testing language, as intended for a diagnostic, but distinct from recommended production/test copy.

### B.4 Recommended copy vs actual

| Path | Recommended title | Recommended body | Actual title | Actual body |
|---|---|---|---|---|
| Production scheduled | `Habit Tracker` | `Time for your daily check-in. A little progress today goes a long way.` | `Habit Tracker` | `Time to check in on your habits for today!` |
| Local Send test | `Habit Tracker` | `Test notification received. Your device can display Habit Tracker notifications.` | `Habit Tracker Reminder` | `Time to check in on your habits today! (Test Notification)` |
| SW undecryptable fallback | — | — | `Habit Tracker` | `A reminder arrived but this device could not decrypt its payload. Check Settings → Daily Reminders.` |

Notes:
- Production title already matches recommended title. Body differs and is approved as a target only — no implementation during this pass.
- Local test body contains testing language `(Test Notification)` — appropriate for a diagnostic, but the recommended test copy reframes it as a display proof.
- Three copy variants exist (production, local test, undecryptable fallback). Alignment is a low-risk copy change in Pass 2.
- `push-sw.js` undecryptable body references "Settings → Daily Reminders" while the Settings section is titled "Reminders" — minor copy inconsistency.

### B.5 Click behavior (closed / backgrounded / open)

`push-sw.js` `notificationclick`:
1. Exact-URL tab → `client.focus()`.
2. Any app tab on origin → `client.navigate(targetUrl)` then focus. **This navigates any open app tab to `/`, potentially discarding unsaved form state** (e.g., an open HabitForm edit).
3. Otherwise → `clients.openWindow(targetUrl)`.

- Closed → `openWindow` works. Backgrounded/open → tab is navigated/replaced, not merely brought forward. No `actions`, no `requireInteraction`, no `silent`; default system sound applies. Accessibility: title/body are plain text; no `lang`/`dir` set (acceptable for English-only app).
- Risk: clicking a reminder while editing a habit discards unsaved form state. Propose safe resolution in Pass 2 (focus-without-navigate when an app tab is open, or only navigate when not on the app).

### B.6 Accessibility / consistency with DESIGN.md

- Reminders card: one status chip (`On`/`Off`/`Blocked`/`Unavailable`), header bell + title, `aria-live="polite"` chip. Tap targets: switch `min-h-14` (phone) / `lg:min-h-11` (desktop) ≥ 44px; time row `min-h-14`; pill buttons 40px visual + vertical pad to 44px; Enable button `h-11` (44px). Matches compact spec.
- iOS 16.4+ Web Push requires installed Home Screen PWA; card shows install guidance when `requiresPWAInstall`. On non-standalone iOS Safari `isSupported` is false → chip reads "Unavailable" even though the install notice follows; chip wording could be clearer ("Install first").
- Denied/unsupported states hide `ReminderSettings`, so an existing enabled server reminder cannot be disabled in-app (see B.8).
- `sendLocalTestNotification` never calls `navigator.serviceWorker.ready` (avoids the permanent-hang bug); uses `getRegistration()`. Well handled.
- Errors are surfaced as visible `testError`/`error` alerts; never swallowed.
- Success line says "Test notification sent!" though only a local display occurred — misleading; recommend "Test notification shown" plus copy that matches recommended test body.

### B.7 Duplicates / idempotency / delivery confirmation

- No `last_sent_at` / dedupe guard. Cron every 15 min; due window `[t, t+15)`. Normally one send per window, but Cloudflare cron retries / overlapping ticks / manual `/send-test` can duplicate.
- DST fall-back repeated hour can double-send (timezone-dependent).
- No delivery confirmation / receipt. Worker logs `sent`/`gone`/`failed` counts only.
- `/send-test` is token-guarded but sends to **every enabled account** (or one `?user=`), not just the caller; token leakage = broadcast risk. Consider scoping to the caller by default.

### B.8 Disabled/removed devices

- A user with `reminder_enabled=true` and `permission=denied` (or unsupported browser) sees only "Blocked"/"Unavailable"; `ReminderSettings` is not rendered, so they cannot toggle `reminder_enabled` off in-app. Worker keeps attempting pushes (OS blocks them).
- Device removal is per-browser only (`unsubscribeThisDevice` removes this endpoint). No remote device list / cross-device revocation UI.
- Dead-endpoint cleanup is passive (404/410 on next send); `last_seen_at` never refreshed.

### B.9 Testing-language leakage

- Production scheduled payload: no test language. ✅
- Local Send test body: `(Test Notification)` — intentional diagnostic language, not leaked into production. ✅
- SW undecryptable fallback: technical diagnostic ("could not decrypt its payload") — not test language, but user-facing jargon. Low severity.
- README describes "send-test / device-registration pills" and "delivery runs on the deployed Worker" — the UI Send test is local-only, not remote; README is slightly misleading about what Send test proves.

### B.10 Approval-required decisions (notifications)

1. Change production body to recommended copy `Time for your daily check-in. A little progress today goes a long way.` (title already matches).
2. Change local test copy to recommended `Test notification received. Your device can display Habit Tracker notifications.` and consider relabeling success to "Test notification shown".
3. Fix `isDue` midnight wrap (high severity bug fix).
4. Add `/send-test` scoping or caller-only default (security/operational).
5. Decide whether denied/unsupported users can disable an existing server reminder in-app (UX/privacy).
6. Keep Send test as secondary diagnostic only — no notification history, no random messages, no per-habit reminders (per constraints).
