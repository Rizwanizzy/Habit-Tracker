# PROJECT_CONTEXT

> Purpose of this file: give any developer, AI model, or application a complete, current
> understanding of this project — concept, stack, architecture, data model, features, and
> conventions. It describes **what is true right now**; the per-pass history lives in
> `CHANGELOG.md`. **Update this file after every completed task** (AGENTS.md rule 11).
> Last updated: 2026-11-15

## 1. What this project is

A personal, **single-user** habit tracking website, inspired by Loop Habit Tracker
(iSoron/uhabits). Web-first, designed mobile-first (every page works at 360px), and
installable as a **PWA** (manifest + auto-updating service worker). No native mobile app,
no payments, no social, no multi-user features.

**Core idea:** the user defines habits (yes/no or numeric with a target, each with its own
color and an optional emoji), checks in with one tap (today or any past date), and sees
streaks, an EMA-based score, and charts in the habit's own color. Skipped days and vacation
days are *neutral*: they are removed from the timeline instead of breaking streaks.

## 2. Documents that matter

| File | Role |
|------|------|
| `AGENTS.md` | Rules for any AI/dev working on the repo. Read before every task. |
| `DESIGN.md` | The design spec ("Aurora Glass": tokens, typography, components, motion). Read before any UI change. |
| `supabase/schema.sql` | Database schema `README` for human setup (re-synced with the live DB — see §Data model). |
| `CHANGELOG.md` | Numbered log of every completed pass (1–115). Append, never rewrite. |
| `README.md` | GitHub-facing overview (features, hosting, scripts, layout). Keep in sync. |

## 3. Stack (verified against `package.json`)

- Vite **8.3.4**, React **19.3.1**, TypeScript **~6.0.3** (strict mode in `tsconfig.app.json`)
- Tailwind CSS **4.3.3** via `@tailwindcss/vite` — `@import "tailwindcss"` in `src/index.css`,
  tokens as CSS variables + `@theme`/`@theme inline`. **There is no `tailwind.config.js`.**
- Supabase (Auth email/password + Google OAuth, Postgres, RLS) via `@supabase/supabase-js` ^2.118.0
- React Router **7.18** (`BrowserRouter`)
- Recharts **3.10** (line/area/bar charts on Overview + Habit detail)
- `vite-plugin-pwa` **2.0.0** — installable PWA, `generateSW`, autoUpdate (precache 44 entries),
  registered explicitly in `main.tsx` via `virtual:pwa-register`, and enabled in dev via
  `devOptions: { enabled: true }`,
  extended with `workbox.importScripts: ['push-sw.js']` for Web Push event handling
- Vitest **5** for unit tests; **oxlint** for linting
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` — drag-and-drop reordering
- `emoji-picker-react` — full emoji picker, **lazy-loaded inside `EmojiPickerField.tsx` only**
  (keeps the picker in its own chunk)
- `@vite-pwa/assets-generator` — one-off icon generation (`npm run icons`)
- Fonts: Space Grotesk (headings/numerals) + DM Sans (body) via Google Fonts in `index.html`
- Heatmap is a **custom component** (`src/components/Heatmap.tsx`), not a library

## 4. Commands (verified against `package.json` / `vite.config.ts`)

```
npm run dev     # dev server — vite --host 0.0.0.0 --port 3000 (NOT 5173)
npm run build   # tsc -b && vite build
npm start       # node server.js — plain static SPA server (Cloud Run deploy route, not used day-to-day)
npm test        # vitest run — currently 291/291 tests in 22 files, all green
npm run lint    # oxlint
npm run icons   # regenerate PWA icons/favicons from public/logo.png (pwa-assets.config.js)
```

- Local dev needs `.env.local` (NOT committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `vite.config.ts` sets server/preview `port: 3000`, `allowedHosts: true`, and a Vitest
  `test.exclude` of `**/node_modules/**`, `**/.kilo/**`, `**/dist/**` so nested tool
  worktrees never run under `npm test`. Keep that exclude if `.kilo/` reappears.
- Run `npm test` AND `npm run build` after every change; fix failures before finishing.

## 5. Deployment

- Production: **Cloudflare Pages — https://habbits-tracker.pages.dev** (migrated from Vercel
  in Nov 2026; Pages auto-enables SPA mode, so deep links survive refresh — no `vercel.json`).
  Never auth against per-deployment/preview `*.pages.dev` URLs (they change every deploy).
- Supabase Auth URL config: Site URL = the production origin; Redirect URLs include
  `<origin>/login` (+ `http://localhost:3000` for dev). Google OAuth client JS origins and
  Auth Platform authorized domains include the same origin.
- Google Auth Platform branding verification (app name/logo on the consent screen) is
  **pending again on the new domain**: with the move to `habbits-tracker.pages.dev`, the
  Branding homepage/privacy URLs and authorized domains must be updated and a **new Search
  Console property** registered for the Pages domain (same HTML file `google84cf7158b3219c46.html`
  in `public/` and the HTML-tag meta in `index.html`), then the usual loop: wait ~24 h and
  one clean "Verify again" resubmission.
- Known permanent quirk: the Google **account chooser** always shows the OAuth redirect
  domain (`…supabase.co`); only a Supabase Pro custom auth domain could change that.

## 6. Architecture overview

```
src/
  main.tsx              entry — applies stored/system theme (<html class="dark">), registers the PWA SW
                        (registerSW from virtual:pwa-register — see vite-plugin-pwa), renders <App/>
  App.tsx               routes: public /login, /verify-email (OTP verification), /forgot-password +
                        /reset-password (in-app password recovery), /welcome (Landing), /privacy (Privacy);
                        inside RequireAuth+AppShell: / (Today), /overview, /review (Performance Review),
                        /profile, /settings, /habits/new, /habits/:id/edit, /habits/:id
  index.css             Tailwind v4 + Aurora-Glass tokens (@theme) + component recipes
  App.css               (unused leftover styles)
  types/
    habit-form.ts       shared HabitForm state types (desktop page + phone layout)
  contexts/
    HabitsContext.tsx   one shared habit list (RequireAuth scope) — every view reads it, never re-sorts
    ProfileContext.tsx  shared profile state (Today header avatar, rail, Profile page)
    SettingsContext.tsx shared day-start hour setting
    VacationsContext.tsx shared vacation-period list
  hooks/
    useAuth.ts          session state via onAuthStateChange
    useHabits.ts        CRUD + reorder/archive, optimistic, shared via HabitsContext
    useEntries.ts       entries grouped per habit, paged fetch (1000/req), save/remove
    useProfile.ts       profile row, avatar upload/remove, 1-hour signed URLs
    useUserSettings.ts  day_start_hour upsert (optimistic + rollback)
    useLogicalToday.ts  reactive logical today (re-arms at msUntilNextDayStart)
    useTheme.ts         light/dark persistence + `themechange` event
    useThemeName.ts     reactive theme name for color math (readableColor)
    useVacations.ts     vacation periods (optimistic, errors exposed not thrown)
    useBackup.ts        JSON backup export (pages past 1000 rows)
    useImportBackup.ts  runs the additive import plan, reports + exposes failures
    useLifetimeStats.ts all-time stats via fetchAllEntries (paged)
    useMediaQuery.ts    SSR-safe matchMedia hook (desktop modal vs phone inline)
    useNotificationPermission.ts Web Push capabilities + permission + local test notification trigger
    useNotificationSettings.ts reminder prefs + device subscriptions (useVacations pattern:
                                 optimistic w/ rollback, errors exposed, endpoint upsert)
    useScheduleHistory.ts Stage 4A schedule epochs per habit from habit_schedule_history
                         (RLS SELECT-only, capability-probe gated, `schedule-reload`
                         window event; exposes epochsByHabit/loading/error)
  lib/                  pure logic + their *.test.ts (33 test files, 524 tests)
    review.ts           Performance Review analysis engine (getCompletedWeekRange, getCompletedMonthRange,
                        getCompletedYearRange, calculatePeriodReview, calculateMonthlyWeeklyBreakdown,
                        calculateYearlyMonthlyBreakdown, generateActionableInsights)
    score.ts            EMA score (SMOOTHING_CONSTANT), scoreSeries, streaks, completionRate;
                        every public fn takes a trailing optional `vacations = []`;
                        scoreRange/scoreSeries also take a trailing optional `epochs`
                        (Stage 2 scoring law, CHANGELOG 118): omitted/empty = original
                        walk bit-identical; with epochs — daily/weekdays/interval step
                        1−0.95^1 per scheduled opportunity (unscheduled days carry),
                        weekly_target steps 1−0.95^M per CLOSED Mon–Sun week (achieved =
                        done ≥ M; current/partial/transition weeks carry), legacy uses
                        the frozen snapshot 1−0.95^(M/N) over all days. Streak/completion
                        fns untouched until the wiring stage. Stage 4A: currentStreak/
                        bestStreak also take a trailing optional `epochs` (off-days
                        neutral; weekly_target weeks are the streak unit — Monday's
                        schedule governs the week, open weeks pending until closed,
                        M reached = done wins); weeklyTargetProgress(habit, entries,
                        date, epochs?) → {done, target} | null for the Mon–Sun week
    overview.ts         completionSeries (daily cumulative completion % adhering to neutral days;
                        Stage 4B: trailing optional `epochs` — off-days neutral, weekly_target
                        scored per closed week mirroring the Stage 2 law),
                        getTop5HabitIds (Overview ranking + tie breaker), resolveFilterMode
    dayStatus.ts        the one source of truth for "is this day counted":
                        before-start/future → done → skipped → vacation → unscheduled → missed
                        ('unscheduled' is neutral and appears only when the caller supplies
                        schedule epochs — omitted/empty context = exact legacy behaviour)
    schedule.ts         Habit Scheduling pure foundation + Stage 3 wiring helpers:
                        ScheduleType/ScheduleConfig/ScheduleEpoch types, weekday-bit mask
                        helpers (Mon=1 … Sun=64, 1–127), weekdayBit,
                        isValidWeekdayMask/isValidInterval/isValidWeeklyTarget, validateSchedule
                        (error list), resolveEpoch (latest effective_from ≤ date, same-day
                        final-wins in append order, never mutates), sortEpochs, isScheduledOn
                        (daily/weekdays/interval anchored to the epoch's own effective_from/
                        weekly_target with Tue–Sun transition weeks neutral/legacy = all days),
                        weekStart/weekEnd (Monday–Sunday only; Review's Sun–Sat cadence
                        untouched), weeklyTargetContext, isTransitionEpoch, transitionWeekStart,
                        isTransitionWeek; Stage 3 helpers: ScheduleMode (types + 'legacy'),
                        weekdayMaskCount (popcount), freqMirrorFor (DB freq pair per mode —
                        the habits_freq_mirror_ck contract), scheduleLabel (human text,
                        legacy shows frozen freq); Stage 4A: opportunityScope
                        (epochs, date → 'day' | 'week' | null — week = weekly
                        target week incl. its first partial transition week,
                        null = ungoverned / weekdays-interval off-days)
    habitForm.ts        Stage 3 pure form×schedule glue: draftSchedule (FormState →
                        ScheduleConfig, legacy/'' → null), sameSchedule, scheduleChanged
                        (RPC gating — staying on legacy is NOT a change), loadedSchedule
                        FromRow/formScheduleFromRow, creationScheduleFields (per-mode
                        CREATE payload: custom = typed freq; daily = freq 1/1 + no
                        schedule_type, bit-identical to pre-Stage-3; other modes = own
                        column + freq mirror), draftScheduleLabel (phone summary)
    scheduleSupport.ts  Stage 3 capability probe: scheduleColumnsAvailable() — one
                        session-cached schedule_type select; PGRST204/42703/message
                        mention = migration not applied → pre-scheduling form; other
                        errors rethrown
    dates.ts            local YYYY-MM-DD (Asia/Kolkata): toLogicalDateString, logicalToday,
                        msUntilNextDayStart, DAY_START_HOURS — never toISOString().slice(0,10)
    clock.ts            now() — reads localStorage['dev-now'] in dev (time travel), real clock in prod
    color.ts            readableColor(hex, theme) ≥3:1, tint() → color-mix strings
    habitTileTheme.ts   Today-tile color vars (+ archived-muted variant) shared with Settings cards
    completion.ts       dayCompletion, monthCalendar/yearCalendar (10-month rolling), intensityPct;
                        Stage 4A: dayCompletion/completionForDates take a trailing optional
                        scheduleByHabit (off-days neutral, weekly-target habits week-scoped
                        out of the day denominator)
    rings.ts            ring layout math (≤7 rings; >7 shares outer rings, inner full rings)
    order.ts            sortHabits/moveHabit/diffOrder — habit ordering engine
    emoji.ts            emoji validation (≤24 code points) + processing helpers
    wheel.ts            wheel-picker snap math
    haptics.ts          navigator.vibrate tick (no-op on iOS)
    id.ts               secure-context UUID fallback (crypto.randomUUID guard)
    profile.ts          Profile types + validators (name ≤80, DOB, phone, gender)
    avatar.ts           prepareAvatar: reject >2MB/non-image, 512px square, WebP blob
    authEmail.ts        email/OTP pure helpers: normalizeEmail, isValidEmail, sanitizeOtp
                        (digits only, leading zeros), isCompleteOtp, otpSlots,
                        emailFromLocationState (safe router-state read)
    authErrors.ts       Supabase Auth error classification + UI copy: authErrorKind
                        (rate_limit/expired/invalid/duplicate_email/network/server/
                        configuration), authErrorMessage(error, context), offlineAuthMessage
    authOtp.ts          auth action wrappers (single-flight guard createSingleFlight):
                        startEmailSignup (session → app; user-only → /verify-email;
                        fake-user duplicate guard), startEmailSignin, startGoogleSignin,
                        verifySignupOtp (verifyOtp type 'email', requires a real session),
                        resendSignupOtp (resend type 'signup')
    verifyEmailFlow.ts  session-only OTP flow state: sessionStorage {email, resendAfter}
                        (never passwords/codes), 60s resend cooldown, read/save/clear +
                        startResendCooldown
    authRecovery.ts     password-recovery actions: requestRecoveryOtp (resetPasswordForEmail,
                        no redirect link — generic anti-enumeration), verifyRecoveryOtp
                        (verifyOtp type 'recovery', requires a real session),
                        updateUserPassword (updateUser {password} on the recovery session,
                        requires a real user), resendRecoveryOtp (ANOTHER recovery request —
                        never resend type 'signup'), signOutRecoverySession (best-effort),
                        validatePasswordPair (required + match only — the configured
                        Supabase policy is the sole strength rule)
    recoveryFlow.ts     session-only recovery flow state: sessionStorage
                        {email, resendAfter, verified} (never passwords/codes), reuses
                        verifyEmailFlow's 60s cooldown helpers, read/save/clear
    backup.ts           JSON export shape (habits, entries incl. status, vacation periods,
                        whitelisted profile/settings fields)
    backupImport.ts     parseBackup/planImport — whitelisted, additive, idempotent
    vacation.ts         isVacationDay, validatePeriod, sortPeriods, vacationDatesInRange
    notifications.ts    Web Push capability detection, permission requests, VAPID key conversion,
                        service worker local test notification dispatch
    reminders.ts        Pass 2 pure helpers: VAPID env reader, subscribe payload extraction,
                        reminder-time normalization, device labeling + DB row types
    stats.ts            lifetime stats (paged all-entries reads)
    milestones.ts       milestone badges (7/21/66/100-day, 25/100/500/1000 check-ins)
    supabase.ts         lazy getSupabase() singleton from VITE_ env vars
  components/
    AppShell.tsx        floating shell: desktop icon rail (logo→Today, Overview, Settings;
                        avatar→Profile) / mobile glass dock (Today, Overview | FAB | Profile, Settings)
    HabitTile.tsx       one-tap check ring, numeric progress bar + inline editor, streak chip,
                        stretched link to detail, TileMoreMenu (edit + skip/undo)
    TileMoreMenu.tsx    top-right three-dot popover (Edit habit / Skip or Undo skip)
    SortableHabitTile.tsx + HabitReorderGrid.tsx   jiggle reorder (dnd-kit, portal DragOverlay)
    TileDensity.tsx     "Per row" stepper (localStorage['tile-columns'])
    ProgressRings.tsx   hero rings (rings.ts geometry, morphs on reorder)
    RingTooltip.tsx     ring hover tooltip
    CompletionCard.tsx + CompletionMonth.tsx + CompletionYear.tsx + CompletionHistoryChart.tsx
                        week/month/year completion views + habit-detail bar chart
    Heatmap.tsx         custom calendar heatmap (tap-cycles empty → done → skipped)
    ScoreLineChart.tsx  Overview multi-line chart (Score / Completion %, halo glow lines, interactive click-to-isolate)
    StatTile.tsx        stat tiles (+ optionally stretched links on Overview)
    RangeSwitch.tsx     30/90/365 (optional `compact`), Week/Month/Year uses it too
    TodayGreeting.tsx   time-of-day greeting (+ `compact` phone variant)
    ThemeIconButton.tsx theme button with rotating Sun/Moon icon, double-click quick toggle, and popover selector for all 7 themes
    HabitFormMobile.tsx phone HabitForm layout below 1024px (shared state with the page)
    EmojiPickerField.tsx lazy emoji-picker-react wrapper
    ColorPicker.tsx + ColorPickerCircle.tsx  swatches + native input + hex field (popover partner)
    WheelPicker.tsx     alarm-clock style wheel pickers (phone habit form)
    HabitPreview.tsx    live tile preview on HabitForm
    DayStartCard.tsx    Settings day-start listbox (anchored popover)
    NotificationCard.tsx Settings Reminders card (compact): header chip On/Off/Blocked/
                         Unavailable, one-line permission states, granted renders ReminderSettings
    ReminderSettings.tsx Vacation-style switch row + dimmed/disabled time visual layer
                         (native time input at opacity-0, DateField overlay — no .date-field)
                         + send-test/device pill footer (danger-tinted Remove device)
    VacationCard.tsx    vacation periods list + start/end form (.date-field inputs)
    BackupCard.tsx + ImportPreviewDialog.tsx  data export/import + additive preview
    ManageTileMobile.tsx phone Settings habit tiles (lg:hidden)
    ProfileBanner.tsx, ProfileDetails.tsx, ProfileDetailsDisplay.tsx, ProfileDetailsEdit.tsx,
    ProfileEditModal.tsx, VerifiedBadge.tsx     profile page pieces (desktop modal edit ≥1024px)
    JourneyCard.tsx (lifetime stats), MilestonesCard.tsx (badges)
    ReviewHeroCard.tsx, ReviewPeriodNav.tsx, ReviewInsightsCard.tsx,
    ReviewBreakdownCard.tsx, ReviewHabitList.tsx, ReviewHabitRow.tsx
                        Performance Review page pieces (period navigator, hero rate card,
                        breakdowns, insights, trajectory tables)
    ConfirmDialog.tsx   portal glass alertdialog (focus trap, Escape, scroll lock)
    RequireAuth.tsx     guard → /welcome when signed out (public landing for brand verification)
    OtpInput.tsx        one real accessible input (autocomplete one-time-code, inputMode
                        numeric, paste autofill) over a six-slot visual presentation
    AuthErrorNotice.tsx shared auth error surface (role="alert", danger tint)
    VerifyEmailRecovery.tsx  recovery form when /verify-email opens without a pending flow
    NewPasswordForm.tsx new + confirm password fields with show/hide toggles (IconEye/
                         IconEyeOff), pair validation via validatePasswordPair, server
                         error surface — used by ResetPassword
    RecoveryCodeStep.tsx self-contained recovery verify step (own OTP state, cooldown,
                         resend = another recovery request, single-flight guards) — used
                         by ResetPassword
    RecoverySuccessCard.tsx final "Password updated" card (no other-device claims)
    icons.tsx           all inline SVG icons (+ IconEye/IconEyeOff)
  pages/
    Today.tsx           bento: header + date pill, hero rings, completion card, tiles
    Overview.tsx        stat tiles + Score / Completion % chart with Top 5 / All / None filters & click-to-isolate
    PerformanceReview.tsx  /review — weekly/monthly/yearly retrospective (hero rate card, breakdowns,
                        insights, habit trajectory tables)
    HabitDetail.tsx     stats, score chart, completion bars, heatmap, skip cycling
    HabitForm.tsx       create/edit habit (desktop ≥1024px layout + shared state → HabitFormMobile)
    Settings.tsx        Day/Habits/Vacation/Data/Account/Notification cards (phone reflow below 1024px)
    Profile.tsx         banner, details, journey, milestones
    Login.tsx           email/password + Google pill (public); signup → /verify-email;
                        "Forgot password?" link near the password field
    ForgotPassword.tsx  public /forgot-password — step 1: request a recovery code
                        (resetPasswordForEmail, generic success, single-flight, offline/
                        rate-limit handling; rate-limited attempts arm the same cooldown)
    ResetPassword.tsx   public /reset-password — steps 2–4: verify the 6-digit recovery
                        code (OtpInput, type 'recovery', real-session required, 60s resend
                        via ANOTHER recovery request), set new + confirm password
                        (updateUser on the recovery session; weak_password → policy error;
                        expired/missing session → restart recovery), then best-effort
                        signOut + success screen. Deliberately NO authenticated-session
                        redirect — the recovery session stays here until the reset ends.
    VerifyEmail.tsx     public /verify-email — 6-digit email OTP verification (real logo,
                        accessible OTP input, resend w/ 60s countdown, reload recovery,
                        already-authenticated redirect)
    Landing.tsx         public /welcome (brand-visible app name + feature cards)
    Privacy.tsx         public /privacy (required for OAuth publication)
public/
  logo.png (master), favicon.ico/.svg, apple-touch-icon.png (+180x180), icon-192/512.png,
  icon-maskable-512.png, maskable-icon-512x512.png, pwa-64/192/512x512.png, icons.svg,
  push-sw.js (Web Push event listener script imported by service worker),
  google84cf7158b3219c46.html (Search Console), assets/ (generated chunks)
```

Other repo files: `server.js` (static SPA server for `npm start`), `metadata.json`,
`pwa-assets.config.js`, `index.html` (fonts, meta, google-site-verification tag),
`supabase/schema.sql`, `supabase/email-templates/` (confirm-signup.html OTP email template +
README with dashboard config / Resend SMTP rollout checklists — repo artifact until manually
pasted into the Supabase project), `DESIGN.md`, `AGENTS.md`, `CHANGELOG.md`,
`PROJECT_CONTEXT.md`, `README.md`.

## 7. Data model (live Supabase DB)

- **habits**: `id uuid pk`, `user_id uuid`, `name text`, `type text` ('boolean'|'numeric'),
  `target numeric >0`, `unit text`, `freq_times int ≥1`, `freq_days int ≥1`, `color text`
  (hex, default '#3B82F6'), `emoji text` (null, or 1–24 code points; retry-widened check),
  `sort_order int`, `archived bool`, `created_at timestamptz`.
- **entries**: `id uuid pk`, `user_id`, `habit_id`, `date date`, `value numeric ≥0 NOT NULL`
  (skipped rows store 0 — never infer anything from `value` when `status='skipped'`),
  `status text` ('done' default | 'skipped'), unique `(habit_id, date)`.
- **vacation_periods**: `id uuid`, `user_id`, `start_date date`, `end_date date null`
  (null = ongoing), `created_at`. A vacation day is neutral for every habit (done still wins).
- **user_settings**: `user_id pk`, `day_start_hour smallint 0..6, default 0`, `updated_at`.
- **profiles**: `user_id pk (= auth.users.id)`, `full_name`, `bio` (≤140 code points,
  motivation line), `date_of_birth`, `gender`, `nationality`, `country`, `address`, `phone`,
  `avatar_path`, `updated_at`. Email is read from the auth session, never stored here.
- **notification_settings** (Pass 2): `user_id pk`, `reminder_enabled bool false`,
  `reminder_time time '20:00:00'`, `timezone text 'Asia/Kolkata'`, created/updated_at.
- **push_subscriptions** (Pass 2): `id uuid pk`, `user_id`, `endpoint unique` (device
  re-subscription upserts), `p256dh`, `auth` (RFC 8291 public key material only — never VAPID
  private keys), `device_label`, `user_agent`, created/updated_at/`last_seen_at`.
- **storage bucket `avatars`**: private, 2 MB, jpeg/png/webp, files at `<user_id>/avatar.webp`;
  displayed via `createSignedUrl` (1 h, refreshed 5 min before expiry).
- RLS enabled on all tables (own-row policies). **Never disable RLS, never ship the service
  role key, never change the schema without telling the user and showing the SQL.**

`supabase/schema.sql` was re-synced with the live DB (2026-11-07, user-approved): it now
creates every table above including the post-release `entries.status`, `profiles.bio`,
`vacation_periods`, and the Pass 2 reminder tables, all guarded and safe to re-run.

## 8. Key rules (full list in AGENTS.md)

1. Every habit's color comes from the DB and flows to rings, charts, heatmaps, tiles, badges.
   Never hardcode habit colors; heatmap intensity uses `color-mix(in srgb, <color> N%, transparent)`.
2. Dates are **logical days**: local `YYYY-MM-DD` in Asia/Kolkata shifted by
   `user_settings.day_start_hour`. All time goes through `lib/clock.ts` `now()` (dev time-travel)
   and helpers in `lib/dates.ts`. Never `toISOString().slice(0,10)`.
3. Score/streak/completion logic lives only in `src/lib/score.ts` (+ `dayStatus.ts`,
   `completion.ts`) as pure, tested functions — never import React/Supabase there. Numeric
   done = `value ≥ target`. Stats count only from the habit's `created_at`.
4. Skipped, vacation and unscheduled days are **neutral** (rules 9 + 10): no EMA step, streaks neither
   count nor break, excluded from completion denominators, but a done check-in still wins
   during vacation. All "is this day counted" questions go through `src/lib/dayStatus.ts`
   with the concrete vacation dates (`vacationDatesInRange`). `unscheduled` appears only
   when the caller supplies schedule epochs (Stage 1 pure foundation; DB migration pending).
5. Check-ins are one-tap optimistic with rollback, and **per-habit remote queues** — never a
   page-wide busy flag (drop-tap bug, CHANGELOG 27).
6. Habit order: `sort_order` asc, ties by `created_at`, is the single source of truth
   (`lib/order.ts`); every listing view reads the shared ordered list and never re-sorts.
7. >7 active habits: warn gently; rings share outer arcs (rings.ts) rather than shrink to
   hairlines.
8. Mobile-first; 44px tap targets (invisible hit-pads below that, positioned to avoid the
   stretched-link/pointer-eat bugs of CHANGELOG 20); loading/empty/error states on every page;
   light + dark and the full 7-theme appearance system from DESIGN.md tokens.
9. Backup import is **additive and idempotent** (`lib/backupImport.ts`): never deletes or
   silently modifies; entry conflicts keep what's already in the app unless the user opts in.
10. After every task: run `npm test` + `npm run build`, update `PROJECT_CONTEXT.md`,
    append to `CHANGELOG.md`, keep `README.md` current.

## 9. Current state — features by page

- **Today** — header (greeting + avatar, date pill with ‹ › + calendar input, backfill,
  ThemeIconButton, "Counting as …" caption when the logical day ≠ calendar day); hero card
  with ProgressRings (center done/total, motivational line, longest-streak chip); Completion
  card (Week | Month | Year views, one user-chosen color from a stored palette, month grid,
  rolling 10-month year heatmap on desktop / 5 months on mobile); habit tile grid with
  TileDensity stepper (1–6 per row, container-query compaction), one-tap check ring with
  burst animation, TileMoreMenu (edit / skip / undo skip — skipped tiles muted with a
  "Skipped" caption; the streak chip + trigger are one corner cluster pinned to the
  tile's top-right inset — on phones the chip follows the SAME per-row state and
  unmounts at 3+ tiles per row (desktop keeps it at every density), while Android gets a
  feature-query + touch/width-scoped 20% badge boost without touching iPhone), long-press jiggle
  reorder (dnd-kit + portal overlay), and a >7-habits note. On desktop the note sits in
  the left column as two intentional lines
  ("Fewer habits are easier to stick to." starts on line 2) while the Scheduled / All
  Habits toggle and Per row stepper stay grouped, right-aligned, and vertically centered
  on the same row; the note is never truncated and wraps naturally when space is tight.
  Mobile: compact two-row header, landscape hero summary card, view toggle below the
  summary, floating dock with FAB.
- **Overview** — RangeSwitch 30/90/365; StatTile row (avg score + delta chip, best habit,
  needs attention — both drill into `/habits/:id`); ScoreLineChart card with habit toggle
  chips, habit-color lines with static halo glow `<Line>`, glass tooltip, Top 5 / All / None
  filter mode (`lib/overview.ts` getTop5HabitIds ranking + tie breaker) and
  click-to-isolate a single habit's line.
- **Performance Review** (`/review`) — retrospective habit performance analysis across Weekly
  (Sun–Sat), Monthly, and Yearly cadences; ReviewPeriodNav with cadence switch and spacious
  period navigator card (‹ / ›, title, sublabel, Latest shortcut); Hero completion rate card,
  monthly/yearly progress breakdowns, deterministic actionable insight recommendations, and
  habit trajectory tables (Improving, Consistent, Declining, Needs Attention). Accessible via
  4th dock item on mobile and 2nd rail item on desktop; the trajectory filter pills use the
  accent-gradient selected treatment, and the page adds no extra bottom padding (AppShell's
  dock clearance is the single source of the last-section-to-dock gap).
- **Habit detail** — glass header (back/edit + color dot), StatTiles (current/best streak,
  30-day completion), score AreaChart (30/90), CompletionHistoryChart bars
  (week/month), custom Heatmap (14px cells, skip-cell outlines, tap-cycle
  empty → done → skipped, Skipped/Vacation legend), loading/error/not-found states.
- **Habit form** — one shared form state: desktop two-column card (name, type, target/unit,
  frequency, ColorPicker + live tile preview) and a phone layout below 1024px (52px name
  input with 52px emoji trigger, emoji picker, Type row, color circle popover, numeric wheel
  picker + unit, repeat alarm-clock wheel pickers, 12px dock gap on iPhone Safari).
- **Settings** — Day card (`DayStartCard` glass listbox), Reminders card (`NotificationCard`
  compact spec: 36px bell + title, ONE `aria-live` chip — "On" success tint / "Off" neutral /
  "Blocked" danger / "Unavailable" neutral —, iOS Safari standalone guidance, and each state
  capped to one short line + one pill: "Enable notifications" (default, 44px accent), one
  13px notice for denied/unsupported; once granted, `ReminderSettings` — "Daily reminder"
  Vacation-style switch row, "Time" row whose field (visual layer with IconClock + short
  12-hour label over a native time input at opacity-0 — DateField overlay pattern, not
  `.date-field`, since its appearance:none breaks Chromium's picker) dims and locks
  (pointer-events-none + disabled) while off, and a pill footer — "Send test" ghost (bell icon) + "Remove device" (danger-tinted pocket pill, visible border for touch) when registered, else one
  "Enable on this device" accent pill; settings/dev rows save to `notification_settings`,
  device registration into `push_subscriptions`), desktop grid: left column Day → Vacation →
  Reminders, right column Data → Habits (Data moved right, user request; wrappers are
  `display: contents` on phones so the 2-col outer grid keeps Day | Data in row 1), Habits card (two-column tile grid on phones with emoji ring
  + one-tap archive; archived section), Vacation card (period list, start/end with native date
  inputs, deletes behind ConfirmDialog), Data card (JSON export incl. profile/settings options;
  additive+idempotent import with preview dialog and explicit "Overwrite" opt-in; phone 166px
  stacked fallback; desktop = one-line caption "Back up or restore habits and check-ins
  (no photos).", Include-profile checkbox row, then Export & Import pills side by side in one
  row at their original natural width), Account card (email read-only, View profile link).
- **Profile** — grid banner + 96/120px avatar (camera popover: change/remove via
  ConfirmDialog; 512px WebP compression), name + VerifiedBadge when email confirmed,
  bio (≤140) with inline editor, personal details card (display + phone inline edit with
  circular save/cancel buttons on phones; desktop edit opens the portal modal
  `ProfileEditModal`), JourneyCard (lifetime stats: longest streak, total check-ins,
  30-day consistency, days tracking), MilestonesCard (animated badge rings).
- **Login / VerifyEmail / ForgotPassword / ResetPassword / Landing / Privacy (public)** —
  glass login card with email/password + Google brand pill; **signup with confirmation
  enabled navigates to `/verify-email`** (state-passed email, sessionStorage reload
  recovery, single-flight submit): six-slot OTP input (one real input,
  `autocomplete="one-time-code"`, numeric keyboard, paste support, leading zeros), verify
  via `verifyOtp type 'email'` requiring a real session before redirecting to `/`, resend
  via `resend type 'signup'` with a 60 s absolute-timestamp countdown (success message only
  after the API succeeds), recovery UI when the flow state is missing, and Change email /
  Back to sign-in exits; error copy covers invalid/expired/rate-limited/offline/config;
  already-authenticated visitors are redirected into the app (no redirect loops). Legacy
  confirmation links stay valid. **Password recovery is a 3-step in-app flow**: Login has a
  "Forgot password?" link near the password field → `/forgot-password` requests a code via
  `resetPasswordForEmail` with always-generic success wording (Supabase replies success for
  unknown emails, so account existence is never revealed) → `/reset-password` verifies the
  6-digit code with `verifyOtp type 'recovery'` (real recovery session required; resend =
  another recovery request, NEVER `resend type 'signup'`, same 60 s cooldown) → new +
  confirm password with show/hide controls submitted via `updateUser({ password })` on the
  recovery session — the configured Supabase password policy is the only strength rule
  (server `weak_password` errors map to readable copy) — then the recovery session is
  signed out (best-effort) and a success screen returns the user to sign-in. Security
  properties: passwords/codes never touch sessionStorage or custom endpoints; flow state
  stores only `{email, resendAfter, verified}`; `/reset-password` performs NO
  authenticated-session redirect so the recovery session can't leak into the dashboard
  mid-flow; dead recovery sessions (expired/missing) surface a restart path instead of a
  fake success; no claim about other devices being signed out (updateUser does not revoke
  them). The email templates live in `supabase/email-templates/` until manually pasted
  into the Supabase Dashboard (see that folder's README). `/welcome` landing (logo,
  "Habit Tracker" h1, feature cards, sign-in + privacy links — visible app name for Google
  verification); `/privacy` policy card.
- **PWA** — manifest (name Habit Tracker, short_name Habits, theme #070A12), generated
  service worker (precache 44 entries), auto-update, extended with `push-sw.js` for
  background push notifications, notification click deep linking, and focus reuse;
  app icons and favicons via `npm run icons`.

## 10. Known gaps

1. **Google branding verification pending on the new Pages domain** — meta-tag + HTML-file
   methods registered (a new Search Console property is needed for
   `habbits-tracker.pages.dev` after the Vercel→Cloudflare move); awaiting the ~24 h window
   then one "Verify again"; until it clears, the consent screen may still show no app
   name/logo (Data-access verification is not needed — openid/email/profile scopes only).
2. **No account linking** — signing in with Google on the same Gmail as the password account
   creates a separate identity/account; habits stay behind the original sign-in.
3. **Count-up numerals** — the only remaining DESIGN.md motion detail (big numerals don't
   count up yet).
4. **Haptics no-op on iOS** — `navigator.vibrate` is unavailable on iOS Safari; ticks only
   fire on Android.
5. **iOS Safari Push requirement** — on iOS 16.4+, Web Push API is disabled in regular Safari tabs
   and requires installing the app to the Home Screen (`display-mode: standalone`). The Settings
   Notification card provides clear instructions when iOS non-standalone is detected.
6. (Log hygiene: progress-log numbering skips 46 — nothing was lost, the number was simply
   never used.)

## 11. Roadmap

1. Finish Google branding verification on the new Pages domain (resubmit once after the
   24 h window; test the consent screen in an incognito session).
2. **Web Push Daily Habit Reminders:**
   - **Pass 1 (Complete):** Web Push Foundation — capability detection, permission flow,
     `push-sw.js` extension, settings diagnostic UI, and VAPID/Cloudflare Workers investigation.
   - **Pass 2 (Complete, 2026-11-07):** `notification_settings` + `push_subscriptions` tables
     live and folded into `supabase/schema.sql`; VAPID public key wired via
     `VITE_VAPID_PUBLIC_KEY` (in `.env.local` and the Cloudflare Pages env); app-side done —
     `useNotificationSettings` hook (settings upsert on `user_id`, device upsert on
     `endpoint`), `ReminderSettings` UI (reminder switch + time + device registration),
     `src/lib/reminders.ts` pure helpers with tests.
   - **Pass 3 (Complete, deployed 2026-11-08):** Cloudflare Worker `habit-tracker-reminders`
     cron dispatcher (zero external cost, native Web Crypto RFC 8291 aes128gcm, validated
     against the RFC Appendix-B vector) — secrets `VAPID_PRIVATE_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`, `TEST_TOKEN` set via `wrangler secret put`; public vars
     `SUPABASE_URL` / `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` in `worker/wrangler.toml`; cron
     `*/15 * * * *`; `/send-test?token=` route; verified end-to-end on production.
3. **Habit Scheduling upgrade (approved v7-corrected architecture):**
   - **Stage 1 (Complete, 2026-11-13):** pure foundation — `src/lib/schedule.ts`
     (`ScheduleType`/`ScheduleConfig`/`ScheduleEpoch`, weekday-bit masks Mon=1…Sun=64,
     `validateSchedule`, `resolveEpoch`, `isScheduledOn`, Mon–Sun `weekStart`/`weekEnd`,
     `weeklyTargetContext`, transition-week helpers; legacy epochs stay all-days-eligible)
     and `dayStatus` `unscheduled` neutral status (optional `schedule` epochs input,
     precedence future → done → skipped → before-start → vacation → unscheduled → missed;
     no/empty context = exact legacy behaviour). Tests: `schedule.test.ts` + extended
     `dayStatus.test.ts`. **The DB migration is NOT yet run; no UI, forms or Supabase
     code changed.**
   - **Stage 2 — scoring law (Complete, 2026-11-13):** only `src/lib/score.ts` + new
     `src/lib/scoreSchedule.test.ts`. `scoreRange`/`scoreSeries` gained a trailing
     optional `epochs` param (additive API; omitted/empty = original walk bit-identical,
     existing callers unchanged — no caller passes epochs yet). Law implemented:
     daily/weekdays/interval = one EMA step per scheduled opportunity (`alphaFor(k) =
     1−0.95^k`, k=1; unscheduled days carry; done-on-unscheduled still wins);
     weekly_target = one step per closed Mon–Sun week (`1−0.95^M`, achieved = done ≥ M
     via `isEntryDone`; the week containing endDate is never scored, partial window-edge
     weeks skipped, `isTransitionWeek` weeks carry); legacy = frozen-snapshot
     `1−0.95^(M/N)` daily, bit-identical to the no-epochs walk. Float-precision catch:
     daily alpha is `alphaFor(1)`, not the bare 0.05 literal (different doubles).
     Approved decisions (ratified by the user 2026-11-13): mid-week switch OUT of
     weekly scores that week under the schedule active on its Monday — later
     completions in that week still count toward the original weekly target;
     skipped/vacation days inside a weekly week do NOT reduce M (neutral days
     never count as completions). Streak/completionRate/Review/callers untouched
     (later wiring stage). Tests: `scoreSchedule.test.ts` (18) — 350 tests in 24 files;
     build clean, lint 0 errors. **DB migration still NOT run; no UI wiring.**
   - **Stage 3 — frontend wiring (Complete, 2026-11-14):** the habit form now speaks
      schedules end-to-end, with the pre-migration DB still working exactly as before:
      - **Capability probe:** `scheduleColumnsAvailable()` (session-cached) selects
        `schedule_type`; a missing-column error = migration not applied → the classic
        Times/Per-days form and plain INSERT/UPDATE (no §7 guards exist pre-migration).
      - **Form modes (desktop + phone, shared `ScheduleEditor` + `WeekdayPicker`):**
        Always exactly five pills — Every day / Specific days (7 chips) / Every
        N days / Weekly goal (M×/wk) / Custom (editable `custom`). A genuinely
        legacy habit highlights Custom (`selectorModeFor`) while its internal
        mode stays `legacy`. A stable origin flag (`legacyHabit`, set on load)
        makes choosing Custom return to that frozen `legacy` mode for the whole
        unsaved session (`modeAfterSelection`), even after temporarily picking
        another mode; the flag clears only after a modern schedule save
        succeeds. Picking Daily/Days/N days/Weekly replaces the legacy schedule.
        Create: custom
        keeps the typed freq (DB normalize reclassifies); daily sends freq 1/1 +
        no schedule_type (bit-identical to pre-Stage-3); other modes send their
        own column + the freq mirror (`creationScheduleFields`).
      - **Legacy phone layout (2026-11-15):** the repeat selector stays the
        original single-row `RangeSwitch` with the same five pills. The
        Times/Days row reuses the editable Custom wheel layout and positioning,
        but each `WheelPicker` is `readOnly`: only the selected value is shown
        (no adjacent numbers, scrolling, dragging, keyboard editing, or value
        changes). `LEGACY_FIXED_EXPLANATION` sits directly below with `mt-2`.
        Read-only behavior and the save/RPC flow are unchanged; editable Custom
        is untouched.
      - **Edit flow:** loaded snapshot vs draft via `scheduleChanged`; changed →
        `updateHabitSchedule` RPC (`append_habit_schedule_epoch`) FIRST, then a
        details-only `updateHabit` (no schedule/freq columns — §7b-safe). Unchanged →
        details-only update only. **Legacy habits show their frozen freq read-only;
        switching modes + save upgrades via RPC explicitly, never silently.**
      - **RPC errors** surface via formError; the form keeps every value (retry-safe,
        same-day final-wins). An RPC success + details failure is a documented partial
        state (schedule changed, details stale) that a retry completes.
      - **HabitDetail** shows "Repeat · {scheduleLabel}" (legacy = frozen freq text).
      - Types: `FormState` schedule fields, `HabitInput` optional schedule columns
        (creation only), `Habit` optional schedule columns (type-only), `HabitRow`
        passthrough in `useHabits` (null schedule_type normalized to undefined).
      - Tests: schedule.test.ts (mask popcount, freq mirror, labels) and new
        habitForm.test.ts — 381 tests in 25 files; build clean; lint 0 errors
        (47 pre-existing warnings, unchanged).
   - **Stage 4A — Today dashboard integration (Complete, 2026-11-14):** the Today
     page now resolves each habit's schedule for the selected logical date via
     the habit's epoch history (v7 migration applied on staging; pre-migration
     DBs keep exact legacy behaviour through the capability probe):
     - **Epoch loading:** new `src/hooks/useScheduleHistory.ts` — one SELECT of
       all `habit_schedule_history` rows (RLS own-rows, SELECT-only; epochs are
       written only by the append RPC), grouped per habit via `sortEpochs`,
       gated by `scheduleColumnsAvailable()` (probe false → empty map, no
       fetch). Exposes `epochsByHabit/loading/error`; errors surface in the
       Today page error state (never swallowed); refetches on the
       `schedule-reload` window event, which `HabitForm` dispatches after an
       RPC epoch save and after a capable creation.
     - **Scope helper:** `opportunityScope(epochs, date)` in schedule.ts →
       `'day' | 'week' | null` (null = unscheduled/ungoverned; 'week' =
       weekly_target active week).
     - **Streaks (score.ts):** `currentStreak`/`bestStreak` gained a trailing
       optional `epochs` param (omitted/empty = legacy walk bit-identical).
       Day-granularity for daily/weekdays/interval/legacy (off-days are
       'unscheduled' → neutral, neither count nor break; done-on-off-day still
       wins); WEEK granularity for weekly_target — the schedule active on a
       week's Monday governs the whole week (ratified Stage 2 rule), an
       achieved week counts as one unit, a closed unachieved week breaks, an
       open (unclosed) week is pending unless M is already reached (done wins);
       transition weeks are neutral (their dones still win as day-dones).
       New `weeklyTargetProgress(habit, entries, date, epochs?)` →
       `{ done, target } | null` for the Mon–Sun week of the date (falls back
       to the habit row's schedule columns when no epochs).
     - **Today wiring:** `dayStatuses` pass epochs (off-days neutral);
       week-scoped habits are excluded from BOTH `doneToday` and `totalToday`
       (progress is per week, never per calendar day); `overallStreak` uses
       epoch-aware `currentStreak`; epochs go to ProgressRings (week-scoped
       habits leave the day totals, their arcs fill with `min(1, done/M)`,
       tooltip "n/M this week"), CompletionCard (off-days drop out of day
       denominators, week-scoped habits excluded — via a trailing optional
       `scheduleByHabit` param on `dayCompletion`/`completionForDates`), and
       HabitReorderGrid (pure module-scope `tileState()` helper: off-day tiles
       muted with "Not scheduled", weekly tiles show "n/M this week" caption
       via the new HabitTile/SortableHabitTile `weekly` prop, epoch-aware
       streaks; the DragOverlay copy shares `tileState`).
     - Check-ins/skip/vacation preserved: done wins everywhere; skip menu,
       undo-skip and vacation neutrality unchanged.
     - Tests: +20 (schedule.test.ts opportunityScope; scoreSchedule.test.ts
       scheduled streaks — weekdays/interval off-days, epoch changes,
       weekly_target week granularity incl. transition weeks and window edges,
       legacy/empty-epochs bit-identity, weeklyTargetProgress) — 401 tests in
       25 files; build clean; lint 0 errors (48 warnings — baseline 47 + the
       new hook's same-category set-state-in-effect).
     - **4A fix (2026-11-14) — weekly habit created mid-week:** a weekly_target
       epoch now scopes its week as 'week' in `opportunityScope` even during
       its first partial (transition) start week, so a habit created Saturday
       shows "0/4 this partial week" (tile caption + ring tooltip, `partial`
       flag via `isTransitionWeek`) instead of a misleading "Not scheduled";
       it stays out of the daily done/total (day-completion pre-exclusion and
       Today's `weekScoped` both key off 'week'). Display-only: `dayStatus`
       keeps partial-week days 'unscheduled' (neutral) and score.ts keeps the
       transition week neutral (never a failed weekly streak) — ordinary
       weekdays/interval off-days are still null → "Not scheduled". Tests +5
       (partial-week progress, dayStatus neutrality, next-full-week progress,
       partial week never fails the streak) — 406 tests in 25 files.
   - **Stage 4B — Overview integration (Complete, 2026-11-14):** the Overview
     page is now schedule-aware, reusing the existing helpers (no duplicated
     scheduling logic):
     - **Wiring:** `useScheduleHistory()` (same hook as Today — probe-gated,
       `schedule-reload` aware) feeds `epochsByHabit` into BOTH metrics of
       the per-habit series: `scoreSeries(..., epochs)` (the Stage 2 law:
       per-scheduled-opportunity steps, weekly_target steps per closed week)
       and `completionSeries(..., epochs)`. Schedule loading/error merge into
       the page's gates. Prev-window series (delta chip) get the same epochs.
     - **completionSeries (`overview.ts`):** gained a trailing optional
       `epochs` param (omitted/empty = legacy walk bit-identical). Mirrors the
       scoring law exactly: daily/weekdays/interval/legacy dates count per day
       with off-days neutral ('unscheduled'; done-on-off-day still wins);
       weekly_target = one opportunity per CLOSED Mon–Sun week (achieved = done
       ≥ M via the now-exported `weeklyTargetAchieved`), the week containing
       endDate and transition/partial window-edge weeks carry. Historical
       epochs are honoured per date via `resolveEpoch`, so past performance
       follows the schedule that governed it.
     - Avg/Best/Needs-attention tiles, Top-5 ranking and chart lines all read
       the epoch-aware series — no separate summary logic touched.
     - Tests: +11 in overview.test.ts (daily/empty/legacy bit-identity,
       weekdays off-days neutral + done-wins, interval anchors, mid-range
       daily→weekdays change, weekly_target closed weeks / skipped rows /
       vacation dones / transition carry / window-edge partial / created-
       mid-week) — 417 tests in 25 files; build clean; lint 0 errors
       (48 warnings, unchanged).
   - **Pre-production integrity fix (2026-11-15):** same-day schedule edits
     no longer coalesce over a `legacy` epoch. The unique
     `(habit_id, effective_from)` constraint prevents a legacy snapshot and a
     new epoch from coexisting, so `20261115_fix_legacy_same_day_overwrite.sql`
     replaces the 7-argument RPC body and raises `P0001` when the existing
     same-day epoch is `legacy`; non-legacy same-day coalescing is unchanged.
     `supabase/tests/20261115_legacy_same_day_overwrite.sql` is a
     rollback-wrapped behavioral regression test, and
     `src/lib/scheduleHistoryMigration.test.ts` statically guards the SQL
     ordering. **Migration not applied by this repository change.**
   - **Production base v7 migration prepared (2026-11-15):**
     `supabase/migrations/20261113_schedule_base_v7.sql` upgrades a
     pre-scheduling database without touching existing habits, users,
     check-ins, or IDs. It deliberately aborts if any scheduling object
     already exists (so staging cannot be overwritten), adds the four habit
     schedule columns and the history table/index/RLS, classifies every
     `1/1` habit as `daily` and every other pair as `legacy` without changing
     `freq_times`/`freq_days`, and seeds exactly one initial epoch per habit
     at its logical `created_at` date using Asia/Kolkata +
     `day_start_hour`. The `5/1` and `1/2` legacy snapshots are preserved
     exactly, and the v7 constraints intentionally do not apply the later
     Custom `times <= days` bound. It creates the three v7 triggers
     (`habits_normalize_schedule`, `habits_guard_schedule_columns`,
     `habits_seed_schedule_history`) and the original 5-parameter RPC that
     `20261114` replaces. Apply `20261113` → `20261114` → `20261115` as one
     sequence; `supabase/tests/20261113_schedule_base_v7.sql` and
     `src/lib/scheduleBaseMigration.test.ts` cover classification and the
     frozen legacy frequencies. **No SQL was executed by this change.**
   - Pending: HabitDetail stats/heatmap epoch wiring, Review epoch wiring,
     backup epoch restore (Stage 5).
4. Optional polish: count-up numerals on stat tiles; periodic backup reminders.
5. Optional (paid): Supabase Pro custom auth domain to brand the OAuth account chooser.
