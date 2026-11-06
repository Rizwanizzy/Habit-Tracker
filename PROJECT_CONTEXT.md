# PROJECT_CONTEXT

> Purpose of this file: give any developer, AI model, or application a complete, current
> understanding of this project — concept, stack, architecture, data model, features, and
> conventions. It describes **what is true right now**; the per-pass history lives in
> `CHANGELOG.md`. **Update this file after every completed task** (AGENTS.md rule 11).
> Last updated: 2026-11-06

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
| `supabase/schema.sql` | Database schema `README` for human setup (⚠️ drifted from the live DB — see §Data model). |
| `CHANGELOG.md` | Numbered log of every completed pass (1–105). Append, never rewrite. |
| `README.md` | GitHub-facing overview (features, hosting, scripts, layout). Keep in sync. |

## 3. Stack (verified against `package.json`)

- Vite **8.3.4**, React **19.3.1**, TypeScript **~6.0.3** (strict mode in `tsconfig.app.json`)
- Tailwind CSS **4.3.3** via `@tailwindcss/vite` — `@import "tailwindcss"` in `src/index.css`,
  tokens as CSS variables + `@theme`/`@theme inline`. **There is no `tailwind.config.js`.**
- Supabase (Auth email/password + Google OAuth, Postgres, RLS) via `@supabase/supabase-js` ^2.118.0
- React Router **7.18** (`BrowserRouter`)
- Recharts **3.10** (line/area/bar charts on Overview + Habit detail)
- `vite-plugin-pwa` **2.0.0** — installable PWA, `generateSW`, autoUpdate (precache 39 entries)
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
npm test        # vitest run — currently 214/214 tests in 16 files, all green
npm run lint    # oxlint
npm run icons   # regenerate PWA icons/favicons from public/logo.png (pwa-assets.config.js)
```

- Local dev needs `.env.local` (NOT committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `vite.config.ts` sets server/preview `port: 3000`, `allowedHosts: true`, and a Vitest
  `test.exclude` of `**/node_modules/**`, `**/.kilo/**`, `**/dist/**` so nested tool
  worktrees never run under `npm test`. Keep that exclude if `.kilo/` reappears.
- Run `npm test` AND `npm run build` after every change; fix failures before finishing.

## 5. Deployment

- Production: **Vercel — https://habbt-tracker.vercel.app** (stable domain; `vercel.json`
  ships the SPA rewrite `/(.*) → /index.html`). Never auth against per-deployment
  `*.vercel.app` URLs (Vercel SSO-protects them; Google sign-in lands on their login page).
- Supabase Auth URL config: Site URL = the Vercel origin; Redirect URLs include
  `<origin>/login` (+ localhost for dev). Google OAuth client JS origins and Auth Platform
  authorized domains include the same origin.
- Google Auth Platform branding verification (app name/logo on the consent screen) is
  **in progress**: Search Console ownership verified via HTML file
  (`public/google84cf7158b3219c46.html`) AND the HTML-tag meta in `index.html`; waiting out
  Google's ~24 h mirroring delay, then one clean "Verify again" resubmission.
- Known permanent quirk: the Google **account chooser** always shows the OAuth redirect
  domain (`…supabase.co`); only a Supabase Pro custom auth domain could change that.

## 6. Architecture overview

```
src/
  main.tsx              entry — applies stored/system theme (<html class="dark">), renders <App/>
  App.tsx               routes: public /login, /welcome (Landing), /privacy (Privacy);
                        inside RequireAuth+AppShell: / (Today), /overview, /profile, /settings,
                        /habits/new, /habits/:id/edit, /habits/:id
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
  lib/                  pure logic + their *.test.ts (16 test files, 214 tests)
    score.ts            EMA score (SMOOTHING_CONSTANT), scoreSeries, streaks, completionRate;
                        every public fn takes a trailing optional `vacations = []`
    dayStatus.ts        the one source of truth for "is this day counted":
                        before-start/future → done → skipped → vacation → missed
    dates.ts            local YYYY-MM-DD (Asia/Kolkata): toLogicalDateString, logicalToday,
                        msUntilNextDayStart, DAY_START_HOURS — never toISOString().slice(0,10)
    clock.ts            now() — reads localStorage['dev-now'] in dev (time travel), real clock in prod
    color.ts            readableColor(hex, theme) ≥3:1, tint() → color-mix strings
    completion.ts       dayCompletion, monthCalendar/yearCalendar (10-month rolling), intensityPct
    rings.ts            ring layout math (≤7 rings; >7 shares outer rings, inner full rings)
    order.ts            sortHabits/moveHabit/diffOrder — habit ordering engine
    emoji.ts            emoji validation (≤24 code points) + processing helpers
    wheel.ts            wheel-picker snap math
    haptics.ts          navigator.vibrate tick (no-op on iOS)
    id.ts               secure-context UUID fallback (crypto.randomUUID guard)
    profile.ts          Profile types + validators (name ≤80, DOB, phone, gender)
    avatar.ts           prepareAvatar: reject >2MB/non-image, 512px square, WebP blob
    backup.ts           JSON export shape (habits, entries incl. status, vacation periods,
                        whitelisted profile/settings fields)
    backupImport.ts     parseBackup/planImport — whitelisted, additive, idempotent
    vacation.ts         isVacationDay, validatePeriod, sortPeriods, vacationDatesInRange
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
    ScoreLineChart.tsx  Overview multi-line score chart (chips + halo glow lines)
    StatTile.tsx        stat tiles (+ optionally stretched links on Overview)
    RangeSwitch.tsx     30/90/365 (optional `compact`), Week/Month/Year uses it too
    TodayGreeting.tsx   time-of-day greeting (+ `compact` phone variant)
    ThemeIconButton.tsx sun/moon toggle in the Today header
    HabitFormMobile.tsx phone HabitForm layout below 1024px (shared state with the page)
    EmojiPickerField.tsx lazy emoji-picker-react wrapper
    ColorPicker.tsx + ColorPickerCircle.tsx  swatches + native input + hex field (popover partner)
    WheelPicker.tsx     alarm-clock style wheel pickers (phone habit form)
    HabitPreview.tsx    live tile preview on HabitForm
    DayStartCard.tsx    Settings day-start listbox (anchored popover)
    VacationCard.tsx    vacation periods list + start/end form (.date-field inputs)
    BackupCard.tsx + ImportPreviewDialog.tsx  data export/import + additive preview
    ManageTileMobile.tsx phone Settings habit tiles (lg:hidden)
    ProfileBanner.tsx, ProfileDetails.tsx, ProfileDetailsDisplay.tsx, ProfileDetailsEdit.tsx,
    ProfileEditModal.tsx, VerifiedBadge.tsx     profile page pieces (desktop modal edit ≥1024px)
    JourneyCard.tsx (lifetime stats), MilestonesCard.tsx (badges)
    ConfirmDialog.tsx   portal glass alertdialog (focus trap, Escape, scroll lock)
    RequireAuth.tsx     guard → /welcome when signed out (public landing for brand verification)
    icons.tsx           all inline SVG icons
  pages/
    Today.tsx           bento: header + date pill, hero rings, completion card, tiles
    Overview.tsx        stat tiles + score chart card
    HabitDetail.tsx     stats, score chart, completion bars, heatmap, skip cycling
    HabitForm.tsx       create/edit habit (desktop ≥1024px layout + shared state → HabitFormMobile)
    Settings.tsx        Day/Habits/Vacation/Data/Account cards (phone reflow below 1024px)
    Profile.tsx         banner, details, journey, milestones
    Login.tsx           email/password + Google pill (public)
    Landing.tsx         public /welcome (brand-visible app name + feature cards)
    Privacy.tsx         public /privacy (required for OAuth publication)
public/
  logo.png (master), favicon.ico/.svg, apple-touch-icon.png (+180x180), icon-192/512.png,
  icon-maskable-512.png, maskable-icon-512x512.png, pwa-64/192/512x512.png, icons.svg,
  google84cf7158b3219c46.html (Search Console), assets/ (generated chunks)
```

Other repo files: `server.js` (static SPA server for `npm start`), `vercel.json`, `metadata.json`,
`pwa-assets.config.js`, `index.html` (fonts, meta, google-site-verification tag),
`supabase/schema.sql`, `DESIGN.md`, `AGENTS.md`, `CHANGELOG.md`, `PROJECT_CONTEXT.md`, `README.md`.

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
- **storage bucket `avatars`**: private, 2 MB, jpeg/png/webp, files at `<user_id>/avatar.webp`;
  displayed via `createSignedUrl` (1 h, refreshed 5 min before expiry).
- RLS enabled on all tables (own-row policies). **Never disable RLS, never ship the service
  role key, never change the schema without telling the user and showing the SQL.**

⚠️ **`supabase/schema.sql` drift (docs-checked 2026-11-06):** the file still contains the
original habits+entries release and does **not** include `entries.status`, `profiles.bio`,
or the `vacation_periods` table, though all three exist in the live DB and the app relies on
them. Anyone re-running the file on a fresh project would miss those. Fixing the file needs
new ALTER/CREATE SQL → ask the user first; do not edit silently.

## 8. Key rules (full list in AGENTS.md)

1. Every habit's color comes from the DB and flows to rings, charts, heatmaps, tiles, badges.
   Never hardcode habit colors; heatmap intensity uses `color-mix(in srgb, <color> N%, transparent)`.
2. Dates are **logical days**: local `YYYY-MM-DD` in Asia/Kolkata shifted by
   `user_settings.day_start_hour`. All time goes through `lib/clock.ts` `now()` (dev time-travel)
   and helpers in `lib/dates.ts`. Never `toISOString().slice(0,10)`.
3. Score/streak/completion logic lives only in `src/lib/score.ts` (+ `dayStatus.ts`,
   `completion.ts`) as pure, tested functions — never import React/Supabase there. Numeric
   done = `value ≥ target`. Stats count only from the habit's `created_at`.
4. Skipped days and vacation days are **neutral** (rule 9 + 10): no EMA step, streaks neither
   count nor break, excluded from completion denominators, but a done check-in still wins
   during vacation. All "is this day counted" questions go through `src/lib/dayStatus.ts`
   with the concrete vacation dates (`vacationDatesInRange`).
5. Check-ins are one-tap optimistic with rollback, and **per-habit remote queues** — never a
   page-wide busy flag (drop-tap bug, CHANGELOG 27).
6. Habit order: `sort_order` asc, ties by `created_at`, is the single source of truth
   (`lib/order.ts`); every listing view reads the shared ordered list and never re-sorts.
7. >7 active habits: warn gently; rings share outer arcs (rings.ts) rather than shrink to
   hairlines.
8. Mobile-first; 44px tap targets (invisible hit-pads below that, positioned to avoid the
   stretched-link/pointer-eat bugs of CHANGELOG 20); loading/empty/error states on every page;
   light + dark themes from DESIGN.md tokens.
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
  "Skipped" caption), long-press jiggle reorder (dnd-kit + portal overlay), >7-habits note.
  Mobile: compact two-row header, landscape hero summary card, floating dock with FAB.
- **Overview** — RangeSwitch 30/90/365; StatTile row (avg score + delta chip, best habit,
  needs attention — both drill into `/habits/:id`); ScoreLineChart card with habit toggle
  chips, habit-color lines with static halo glow `<Line>`, glass tooltip.
- **Habit detail** — glass header (back/edit + color dot), StatTiles (current/best streak,
  30-day completion), score AreaChart (30/90), CompletionHistoryChart bars
  (week/month), custom Heatmap (14px cells, skip-cell outlines, tap-cycle
  empty → done → skipped, Skipped/Vacation legend), loading/error/not-found states.
- **Habit form** — one shared form state: desktop two-column card (name, type, target/unit,
  frequency, ColorPicker + live tile preview) and a phone layout below 1024px (52px name
  input with 52px emoji trigger, emoji picker, Type row, color circle popover, numeric wheel
  picker + unit, repeat alarm-clock wheel pickers, 12px dock gap on iPhone Safari).
- **Settings** — Day card (`DayStartCard` glass listbox), Habits card (two-column tile grid
  on phones with emoji ring + one-tap archive; archived section), Vacation card (period list,
  start/end with native date inputs, deletes behind ConfirmDialog), Data card (JSON export
  incl. profile/settings options; additive+idempotent import with preview dialog and explicit
  "Overwrite" opt-in; phone 166px stacked fallback), Account card (email read-only,
  View profile link).
- **Profile** — grid banner + 96/120px avatar (camera popover: change/remove via
  ConfirmDialog; 512px WebP compression), name + VerifiedBadge when email confirmed,
  bio (≤140) with inline editor, personal details card (display + phone inline edit with
  circular save/cancel buttons on phones; desktop edit opens the portal modal
  `ProfileEditModal`), JourneyCard (lifetime stats: longest streak, total check-ins,
  30-day consistency, days tracking), MilestonesCard (animated badge rings).
- **Login / Landing / Privacy (public)** — glass login card with email/password +
  Google brand pill; `/welcome` landing (logo, "Habit Tracker" h1, feature cards, sign-in +
  privacy links — visible app name for Google verification); `/privacy` policy card.
- **PWA** — manifest (name Habit Tracker, short_name Habits, theme #070A12), generated
  service worker (precache 39 entries), auto-update; app icons and favicons via
  `npm run icons`.

## 10. Known gaps

1. **`supabase/schema.sql` drift** — missing `entries.status`, `profiles.bio`,
   `vacation_periods` (live DB has all three; see §7). Needs a user-approved SQL resync.
2. **Google branding verification pending** — meta-tag + HTML-file methods registered;
   awaiting the ~24 h window then one "Verify again"; until it clears, the consent screen
   may still show no app name/logo (Data-access verification is not needed — openid/email/
   profile scopes only).
3. **No account linking** — signing in with Google on the same Gmail as the password account
   creates a separate identity/account; habits stay behind the original sign-in.
4. **Count-up numerals** — the only remaining DESIGN.md motion detail (big numerals don't
   count up yet).
5. **Haptics no-op on iOS** — `navigator.vibrate` is unavailable on iOS Safari; ticks only
   fire on Android.
6. (Log hygiene: progress-log numbering skips 46 — nothing was lost, the number was simply
   never used.)

## 11. Roadmap

1. Finish Google branding verification (resubmit once after the 24 h window; test the
   consent screen in an incognito session).
2. Resync `supabase/schema.sql` with the live DB (show SQL first, get user approval).
3. Optional polish: count-up numerals on stat tiles; periodic backup reminders.
4. Optional (paid): Supabase Pro custom auth domain to brand the OAuth account chooser.
