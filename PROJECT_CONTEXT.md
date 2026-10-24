# PROJECT_CONTEXT

> Purpose of this file: give any developer, AI model, or application a complete, current
> understanding of this project — concept, purpose, stack, architecture, features, and
> progress — without reading every source file. **Update this file after every completed task.**
> Last updated: 2026-10-26

## 1. What this project is

A personal, single-user habit tracking website, inspired by Loop Habit Tracker (iSoron/uhabits).
Web-first, designed mobile-first, and intended to become an installable PWA later. No native
mobile app. No payments, social, or multi-user features.

**Core idea:** the user defines habits (yes/no or numeric with a target), checks them in with
one tap (today or any past date), and sees streaks, scores, and charts in the habit's own color.

## 2. Documents that matter

| File | Role |
|------|------|
| `AGENTS.md` | Rules for any AI/dev working on the repo. Read before every task. |
| `DESIGN.md` | The design spec (tokens, typography, components, motion). Read before any UI change. |
| `supabase/schema.sql` | Database schema (habits + entries, RLS, per-user policies). Run in Supabase SQL editor. |

## 3. Stack

- Vite 8 + React 19 + TypeScript **strict mode** (enabled in `tsconfig.app.json`)
- Tailwind CSS v4 via `@tailwindcss/vite` — `@import "tailwindcss"` in `src/index.css`, tokens as CSS variables + `@theme`/`@theme inline` (no `tailwind.config.js`)
- Supabase (Auth email/password, Postgres, RLS) via `@supabase/supabase-js`
- React Router 7 (`BrowserRouter`) for pages
- Recharts for line, area and bar charts (Overview, Habit detail)
- Vitest for unit tests
- Space Grotesk (headings/numerals) + DM Sans (body) via Google Fonts in `index.html`
- `vite-plugin-pwa` — installable PWA (manifest + generated service worker, auto-update)
- Heatmap is a custom component, not a library

### Design system: "Aurora Glass" (DESIGN.md is authoritative)

- Aurora background: body gets `--bg-base` + layered radial glows (`--bg-aurora`), fixed so it never scrolls away. Dark is the preferred theme per DESIGN.md; the app starts in the system's color-scheme (or the user's stored choice).
- Glass recipes: `.glass-card` / `.glass-pill` utilities — `blur(20px) saturate(140%)`, 1px `--border`, inset top highlight, deep theme shadow.
- Accent utilities: `.bg-accent-gradient` (135° gradient token) and `.glow-accent` (soft accent shadow). Dark: `#7C83FF→#22D3EE`; light: `#4F46E5→#0EA5E9`.
- Typography: `text-page-title` 32/40, `text-hero` 56/56 tabular-nums (Space Grotesk), `text-section-title` 18/24, `text-habit-name` 17/24, `text-body` 15/22, `text-caption` 12/16 uppercase with .08em tracking. Display font auto-applied to these utilities.
- Radii: shell 32 (`rounded-shell`), cards 28 (`rounded-card`), tiles 24 (`rounded-tile`), inputs 16 (`rounded-input`), pills full (`rounded-pill`).
- Habit color rules (§2): habit colors carry rings, bars, charts, heatmaps, tiles (via `tint()`), and glows — never body text. `readableColor(hex, theme)` in `src/lib/color.ts` guarantees ≥3:1 contrast against the glass surface for every foreground use.
- Motion helper: `prefers-reduced-motion` collapses animations/transitions globally in CSS.

## 4. Commands

```
npm run dev     # dev server (http://localhost:5173)
npm run build   # tsc -b && vite build
npm test        # vitest run (44/44 passing)
npm run icons   # generate PWA icons/favicons (@vite-pwa/assets-generator)
```

For local dev, `.env.local` (NOT committed) must contain:
```
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<anon key>
```

## 5. Project status / progress log

### Done
1. **Foundation setup** — `@tailwindcss/vite` plugin wired in `vite.config.ts`; base `src/index.css` with `@import "tailwindcss"`.
2. **Pure logic** (`src/lib/`):
   - `score.ts` — habit score as an exponential moving average (`SMOOTHING_CONSTANT = 0.05`, per-day weight from `freq_times/freq_days`), `scoreSeries` (daily EMA for charts; last point ≡ `scoreRange`), `currentStreak`, `bestStreak`, `completionRate`, `isDone` (numeric done when `value >= target`); stats only count from habit `created_at`.
   - `dates.ts` — local `YYYY-MM-DD` helpers for `Asia/Kolkata` (`toLocalDateString`, `todayString`, `parseLocalDate`, `addDays`, `daysBetween`). Never `toISOString().slice(0,10)` — UTC date near midnight breaks the IST day.
   - `color.ts` — `readableColor(hex, theme)` (walks HSL lightness until WCAG contrast ≥ 3:1 against the theme's glass surface; dark raises lightness, light lowers it), `tint(hex, percent)` → `color-mix(in srgb, …, transparent)` strings, plus `contrast()` and `surfaceColor()` helpers. ✅ covered by `color.test.ts` (very dark color on dark theme, very light on light theme, 3-digit hex, invalid input).
   - `profile.ts` — `Profile`/`ProfileInput` types, `GENDERS`, `isGender`, `validateFullName` (≤ 80 chars), `validateDateOfBirth` (YYYY-MM-DD, on/after 1900, not future), `validatePhone` (7–15 digits, optional leading +, common separators), `validateGender`, `validateProfile` (aggregates), `initialsFrom(name, email)` for avatar fallback. Pure, no React/Supabase. ✅ covered by `profile.test.ts`.
   - `avatar.ts` — `prepareAvatar(file)`: rejects non-images and files over 2 MB, center-crops to a square, resizes to 512px, encodes as WebP via canvas, returns a Blob. Browser-only (canvas).
   - `supabase.ts` — lazy singleton `getSupabase()` from VITE_ env vars, clear error when missing.
   - Tests: `dates.test.ts` (midnight boundary), `score.test.ts` (miss after long streak, numeric below target, created mid-range), `color.test.ts`, `profile.test.ts` (validation + initials). **All passing.**
3. **Aurora Glass redesign (in progress, UI-only — no logic/DB changes):**
   - **Done — Aurora Glass redesign (in progress, UI-only — no logic/DB changes):**
   - **Done:** `index.css` rewritten to DESIGN.md §1/§3/§4 tokens (aurora bg, glass recipes, Space Grotesk/DM Sans, radii shell 28→32 scale, caption uppercase); `src/lib/color.ts`; **`AppShell.tsx` rebuilt** — floating rounded shell (inset 16px, max 1280px, radius 32px) with a 72px circular icon rail on desktop (logo mark at top, clickable → Today; Today/Overview/Settings in middle — Today reached via logo click since `/` is the default route; Profile avatar + theme toggle at bottom group; sign-out removed from rail, now on Profile header as an icon button opening `ConfirmDialog`); mobile = floating glass bottom dock (64px, 16px inset, safe-area padding, 3 items: Today, Overview, Settings); `index.html` loads the new fonts and `viewport-fit=cover`. **Cursor pointer rule added to `@layer base`** so all buttons, links, role="button" etc. show hand cursor; hover states + focus rings added to rail icons, theme toggle, range switch segments, habit check rings, color swatches, chips, and the sign-out icon.
   - **Done — Today page bento (DESIGN.md §8):** header with page title + date caption, glass date pill (‹ › arrows + native calendar input + Today shortcut, never lets you navigate past today), gradient 48px "Add habit" pill. Row 1: hero card (5 cols) with `ProgressRings` — concentric rings, one per habit (outermost = first, max 7, stroke 10/gap 6, tint 12% tracks), draw-in 900ms then morph on check-in 700ms; center shows `done / total` (tabular) + caption; motivational line + longest-streak flame chip. Weekly card (7 cols) with `WeeklyCompletion` — last 7 days, one bar per day = share of eligible habits done (habits only count from their `created_at`), native tooltip per bar, today's bar highlighted with glow, draw-in + 40ms stagger, empty state text. Row 2: `HabitTile` grid (1 col mobile / 2 tablet / 3 desktop) — min 132px, `linear-gradient(145deg, tint 22%, tint 6%)` bg, tint 35% border (70% on hover + 2px lift), 44px check ring (pending = 2px habit ring; done = fill + tint glow + white check) with ring-pop (280ms) and burst of 6 habit-colored dots, name in text-fg (habit color never used for body text), flame streak chip in `readableColor`, numeric tiles show a 6px progress bar + "12 / 30 min" (unit once, tap to open inline value input — save/cancel), edit pencil hover-visible (always on mobile). Motion utilities in `index.css`: `ring-pop`, `burst-dot`, `bar-in`, `fade-up` (staggers via animationDelay), `.habit-tile` hover recipe, `.ring-progress`/`.ring-draw`; all collapse under `prefers-reduced-motion`. New files: `components/ProgressRings.tsx`, `components/WeeklyCompletion.tsx`, `components/HabitTile.tsx` (replaces deleted `components/HabitRow.tsx`), `hooks/useThemeName.ts` (reactive dark/light for `readableColor`, listens to the `themechange` event; existing hooks untouched).
   - **Remaining passes:** count-up numerals only — Settings, HabitForm, Login, HabitDetail (stat tiles, score chart, bars, heatmap) are all restyled now (see item 8).
4. **App shell + auth** (`src/components/`, `src/hooks/`, `src/pages/`):
   - `useAuth.ts` — session state live via `onAuthStateChange`.
   - `RequireAuth.tsx` — guard; redirects to `/login` when signed out; loading state while checking.
   - `Login.tsx` — Supabase email/password sign in + create account; navigates to `/` on success (bug fixed: Login sits outside the guard so it must navigate itself).
   - `ThemeToggle.tsx` — light/dark toggle, in Settings page.
   - Login works end-to-end against the user's Supabase project.
5. **Habit tracking features:**
   - `supabase/schema.sql` — `habits` + `entries` tables, RLS on, per-user policies, unique `(habit_id, date)`. Run once in the Supabase SQL editor (auth works end-to-end, which suggests the tables already exist — confirm before assuming).
   - `useHabits.ts` — fetch active/all habits (`sort_order` order), `createHabit`, `updateHabit`, optimistic `archiveHabit` with rollback; `extractError` helper.
   - `useEntries.ts` — entries grouped per habit (last 365 days), `saveEntry` (upsert on `habit_id,date`), `removeEntry`.
   - **Today page** — superseded by the Aurora Glass bento described in item 3 above (same data flow: optimistic one-tap check-in with rollback, inline numeric value input, loading/empty/error states, gentle >7-habits warning).
   - **HabitForm page** (`/habits/new`, `/habits/:id/edit`) — name, yes-no/numeric type (target + unit), frequency (times per N days), ColorPicker.
   - **ColorPicker component** — 10 preset swatches + native `<input type="color">` + hex text field.
   - **Settings page** — Appearance (theme toggle), Habits (Archive / Restore, archived history kept), Account (email + Sign out).
6. **Habit detail page** (`/habits/:id`, reached by tapping a habit name on Today):
   - `scoreSeries()` added to `score.ts` (daily EMA series for charts; final point equals `scoreRange`; covered by a new test).
   - **Stat tiles** — current streak, best streak, 30-day completion rate.
   - **Score line chart** (Recharts `AreaChart`, 30d/90d toggle) — smooth monotone line 2.5px in the habit color with 8% fill under the line, horizontal gridlines in chart-grid color, % axis, custom surface-raised tooltip.
   - **Weekly/monthly completion bar chart** (`CompletionHistoryChart`) — Week/Month toggle chips in the habit color (active = filled), ~14px bars with 6px top radius, value labels above bars, custom tooltip.
   - **Custom calendar Heatmap** (`Heatmap`) — weeks as columns, Sun–Sat rows, month labels on top; 4 intensity levels via `color-mix(in srgb, <color> 40/70/100%, transparent)`, missed days in neutral surface, future days transparent; horizontally scrollable on mobile; tapping a day toggles that check-in.
   - Loading / error (with retry) / not-found states; back arrow + edit pencil in the header.
7. **Overview page** — Aurora Glass restyle per DESIGN.md §6/§7/§8 (data flow unchanged: `useHabits`/`useEntries` + `scoreSeries`, merged per date so later-created habits' lines start at creation; score logic untouched):
   - Header with the sliding `RangeSwitch` (30/90/365, segmented accent pill, 36px).
   - Row 1 stat tiles via new `StatTile.tsx` (`StatTile` glass card + `DeltaChip` arrow chip success/danger + `HabitDotName` dot+name line): average score for the range with a delta chip vs the previous equal-length window, best habit, needs attention.
   - Row 2 large chart card with the habit chips **inside it** (`ScoreLineChart.tsx`): chips are 36px pills with a habit-color dot, selected = tint 20% fill + tint 40% border, off = 50% opacity; chart = monotone 2.5px habit-color lines, glow via a wide translucent halo `<Line>` per habit (`dataKey="g:<id>"`, strokeWidth 9, opacity 0.18, static) drawn under the real line, horizontal dashed grid only, no axis lines, 12px `chart-axis` labels, 8px active dot with 3px white ring, glass tooltip (16px radius, colored dot + habit name + value; filters out `g:` halo rows), empty state "Check in a habit to see your score".
   - Row 3 per-habit sparkline cards (`Sparkline.tsx`, pure SVG habit-color polyline with white-ringed end dot), each linking to `/habits/:id`.
   - Loading / error+retry / no-habits empty states. UI-only: rows gain a visualization-only `g:<habitId>` duplicate key for the halo lines.
8. **Settings / HabitForm / Login / HabitDetail restyle (UI-only, no logic changes):**
   - **Settings** — two-column desktop grid (Appearance + Account left, Habits right), glass cards with fade-up stagger, habit rows use surface-raised pills with a color dot, name links to the edit page, pencil icon button, glass pill Archive/Restore, "N active · M archived" caption, sign-out as a subtle danger-outline pill.
   - **ThemeToggle** rebuilt as a switch (role="switch"): 44px track, sliding accent-gradient knob, sun/moon icons cross-fade + rotate (CSS transitions, reduced-motion safe), current mode text beside it.
   - **ColorPicker** per §6: 10 preset 32px round swatches (selection ring using `var(--surface)` + habit-color outer ring) plus a rainbow conic "custom" swatch that opens a hidden native `<input type="color">` and shows the current color as its inner dot when a non-preset hex is chosen; hex text field kept.
   - **HabitForm** — two-column glass grid (details card left: name, type via `RangeSwitch`, numeric target/unit, frequency; color card right: ColorPicker + live tile-style preview built from `tint()` that updates instantly). New `.input-field` CSS recipe (§6: 52px, surface-2, 16px radius, accent focus glow). Primary/Cancel buttons are gradient/glass pills. Save/create logic unchanged.
   - **Login** — centered glass card over the aurora, gradient logo mark (check inside a ring) above the title, gradient primary button with glow, glass-pill "Create account", 52px `.input-field` inputs, error/success chips rounded-input. Auth logic unchanged.
   - **HabitDetail** — stat tiles now use the shared `StatTile` (caption on top, big numeral, staggered fade-up); score chart per §7: monotone 2.5px habit-color line with gradient area fill (color 30% → 0% via per-habit SVG `linearGradient`), halo glow line (`g:score` key), dashed horizontal grid, 12px axis labels, white-ringed active dot, glass tooltip, `RangeSwitch` 30/90 window, empty state "Check in a habit to see your score"; `CompletionHistoryChart` bars are 10px with fully rounded tops and the latest bucket glows via `Cell` drop-shadow, Week/Month chips use tint 20%/40% style, glass tooltip; `Heatmap` is 14px cells / 4px radius / 4px gap with levels at 12/35/65/100% (boolean done → 100%, numeric ratio ≥ 0.33 → 35%, ≥ 0.66 → 65%; top level has a small glow), 11px month/weekday labels; two-column desktop (score + history side by side, calendar full width below); glass header with back/edit circle pills and a habit-color dot beside the title.
9. **DESIGN.md compliance sweep (fix pass):**
   - Verified: every card uses `glass-card` (habit tiles use the sanctioned tinted `habit-tile` recipe; Settings rows are list rows); the only habit-color `color:` in codebase is the flame *icon* wrapper in `HabitTile` (glyph via `readableColor`, allowed); every page uses grids on desktop (Login's centered card is specced); no page-level horizontal scroll at 360px (date pill, form grids, Settings rows all truncate; heatmap scrolls internally by design).
   - **prefers-reduced-motion:** the global CSS kill-switch only covered CSS animations, so Recharts draw-ins now respect it too — module-level `REDUCED_MOTION` matchMedia check + `isAnimationActive={!REDUCED_MOTION}` on the Overview `ScoreLineChart` lines, HabitDetail `Area`, and `CompletionHistoryChart` `Bar` (burst/ring/fade/bar CSS animations were already covered).
   - **Tap targets:** Settings habit-name link and HabitDetail "Back to Today" text link are now 44px (`flex h-11`); specced controls below 44px visually (36px chips, 32px color-select swatches, RangeSwitch options) got invisible hit-area extensions via `after:` pseudo-elements so the full 44px is tappable without changing the look; heatmap cells stay 14px per DESIGN.md §7 spec.
   - Small consistency fixes: Today action-error chips match the other pages (text-body / rounded-input); Login "Create account" hover now uses `hover:bg-surface-raised` instead of white text (invisible on light theme); Today Retry button gained a danger hover fill.

10. **Profile & avatar data layer** (UI built in item 11):
   - `src/lib/profile.ts` — `Profile`/`ProfileInput` types, `GENDERS`, `isGender`, `validateFullName` (≤80 chars), `validateDateOfBirth` (YYYY-MM-DD, on/after 1900, not future), `validatePhone` (7–15 digits, optional leading +, common separators), `validateGender`, `validateProfile` (aggregates), `initialsFrom(name, email)` for avatar fallback. Pure, no React/Supabase. ✅ `profile.test.ts`.
   - `src/lib/avatar.ts` — `prepareAvatar(file)`: rejects non-images and files over 2 MB, center-crops to a square, resizes to 512px, encodes as WebP via canvas, returns a Blob.
   - `src/hooks/useProfile.ts` — loads the profile row (may not exist yet via `maybeSingle`), `save` upserts on `user_id`, `uploadAvatar` (to `<user_id>/avatar.webp` with upsert then saves `avatar_path`), `removeAvatar` (deletes file and clears path), 1-hour signed URL for display with auto-refresh 5 min before expiry, exposes auth `email` and `emailConfirmed` (`email_confirmed_at`), surfaces errors (sets state + rethrows). UI wiring in item 11.
11. **Profile page** (`/profile`, DESIGN.md §11, UI pass — data layer from item 10 used as-is):
    - Components: `ProfileBanner.tsx` (full-width grid background banner 120/160px with `.banner-grid` 56px square-grid pattern + radial mask-image fade toward bottom/sides, no glass-card/border/radius; avatar 96/120px sitting inside the grid ~24px from top with 4px `ring-bg-base`, accent glow, initials fallback; 36px camera button opening a keyboard-accessible glass popover with "Change photo" and "Remove photo" — the latter only when a photo exists, with a confirmation step via `ConfirmDialog`; popover closes on outside click and Escape; name 32/40 + blue verified badge when email confirmed; email below); `ProfileDetails.tsx` + `ProfileDetailsDisplay.tsx` + `ProfileDetailsEdit.tsx` (28px-radius glass card: header separated by 1px border with a subtle 36px ghost/outline Edit pill; rows 35%/65% label/value stacked on mobile with dashed dividers and "Not added" for empties; edit mode = 52px `.input-field` inputs in place, Gender via `RangeSwitch` with a new optional `dense` prop (caption-size text for 4 options; null maps to `prefer_not_to_say`), DOB `type=date` capped at today, phone `type=tel`, email read-only with lock icon; Save (48px primary) and Cancel (secondary) replace Edit in the same sticky card-header spot, per-field inline validation errors from `validateProfile`).
    - `pages/Profile.tsx` — breadcrumb header "My Account / Profile" (no action pill; sign-out icon on the right opens `ConfirmDialog` danger variant); skeleton shimmer via `.skeleton`; page-level error card with Retry only when `error && !profile` (save/upload failures surface as toasts instead); toasts fixed-bottom auto-dismiss 2.6s ("Profile saved" / upload/remove/save errors via `extractError`).
    - `src/components/ConfirmDialog.tsx` — shared portal-rendered confirmation dialog: renders scrim + glass panel into `document.body` via `createPortal`; scrim `rgba(4,6,14,0.55)` dark / `rgba(15,23,42,0.28)` light with `backdrop-filter: blur(10px) saturate(120%)`; panel glass `min(480px, calc(100vw-32px))`, radius 28px, theme-specific gradients/borders/shadows, `backdrop-filter: blur(28px) saturate(150%)`, `@supports not (backdrop-filter)` opacity 0.94 fallback; top accent line; title 22px; description 15px sentence case; Cancel ghost pill + danger confirm pill (44px high); `role="alertdialog"`, focus trap, Escape cancels, focus returns to opener, body scroll lock, scale+fade entry 200ms (disabled under prefers-reduced-motion).
    - Nav: Profile is accessed via the avatar in the Today header (navigates to /profile) and via the "View profile" link in Settings; not in the rail or mobile dock. /profile route added inside RequireAuth; icons gained IconUser, IconCamera, IconLock; CSS gained .banner-grid, .banner-bg (radial mask fade), @keyframes spin + .progress-spin, @keyframes shimmer + .skeleton, dialog-scrim/dialog-panel/dialog-accent-line (reduced-motion covered by the global rule).
    - Note: the edit header uses `sticky top-2`; the shell's `overflow-hidden` wrapper may prevent it from engaging on scroll (best-effort); layout covers 360px and 1440px in both themes.
    - DB field `country` is included as a row in both display and edit modes so `save` never nulls it.

### Remaining next steps (Aurora Glass passes still to do)
- All main pages are implemented and the PWA is live (manifest + generated service worker, auto-update). Every page is restyled to DESIGN.md except one motion detail: big-numeral count-up on stat tiles.

## Branding and icons (new)
- Logo source: `design-refs/habit-tracker-logo.png` / `public/logo.png` (served copy).
- Generated via `npm run icons` (`@vite-pwa/assets-generator`, `pwa-assets.config.js`): `public/logo.png` (logo master), `public/favicon.ico`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` (logo ~70% on #070A12), `public/apple-touch-icon.png` (180x180, #070A12).
- `index.html`: favicon links (SVG + ICO), apple-touch-icon, theme-color `#070A12`, title "Habit Tracker".
- `vite.config.ts` PWA manifest: theme_color/background_color `#070A12`, icons 192/512/maskable-512.
- Logo shown in: sidebar header (mark + hidden wordmark), Login page above card.

## 6. Key rules any contributor must follow (from AGENTS.md — full list there)

- Every habit carries its own user-chosen `color`; never hardcode habit colors. Heatmap intensity: `color-mix(in srgb, <color> N%, transparent)`.
- Dates: local `YYYY-MM-DD` in `Asia/Kolkata`; helpers in `src/lib/dates.ts`.
- Score logic only in `src/lib/score.ts`, pure, tested.
- Check-ins: one tap, optimistic, rollback on error; easy backfill.
- Mobile-first, 44px tap targets, loading/empty/error states everywhere; light + dark themes.
- Named exports, functional components/hooks, no `any`, explicit Supabase error handling.
- Run `npm test` and `npm run build` after every change; fix failures before finishing.
- Never disable RLS, never use the service role key, never commit `.env.local`.
- Don't change the DB schema without telling the user and showing the SQL.
- **Maintain `PROJECT_CONTEXT.md` after every task and keep `README.md` current for GitHub** (AGENTS.md rule 8).

## 7. Architecture overview

```
src/
  main.tsx            entry — applies stored/system theme, renders <App/>
  App.tsx             BrowserRouter routes (/login outside guard; / = Today default route reached via logo click, /overview, /profile,
                      /settings, /habits/new, /habits/:id/edit, /habits/:id inside RequireAuth + AppShell)
  index.css           Tailwind v4 + design tokens (@theme) + dark class strategy
  lib/
    score.ts          pure score/streak/completion logic (SMOOTHING_CONSTANT)
    dates.ts          Asia/Kolkata local date helpers
    supabase.ts       lazy Supabase client (getSupabase)
    color.ts          readableColor / tint / contrast (WCAG-3:1 habit color visibility)
    profile.ts        Profile type + validation + initialsFrom (pure)
    avatar.ts         prepareAvatar: crop/resize/encode WebP via canvas (browser-only)
  hooks/
    useAuth.ts        session via onAuthStateChange
    useTheme.ts       dark toggle + persistence (dispatches `themechange`)
    useThemeName.ts   reactive dark/light for readableColor (listens to `themechange`)
    useHabits.ts      habits CRUD/archive + loading/error
    useEntries.ts     entries per habit + save/remove
    useProfile.ts     profile row load/save (upsert), avatar upload/remove, signed URL (1h, auto-refresh)
  components/
    AppShell.tsx      floating shell: icon rail (desktop) / glass dock (mobile); logo mark at rail top (clickable → Today); Today/Overview/Settings in middle; Profile avatar at rail bottom; theme toggle; sign-out removed from rail, now on Profile header
    RequireAuth.tsx   auth guard
    TodayGreeting.tsx greeting block: avatar + time-of-day greeting + "Hi, <name>" + date; avatar links to /profile
    HabitTile.tsx     Today habit tile (check ring + burst, streak chip, progress)
    ProgressRings.tsx hero concentric rings (one per habit, draw-in + morph)
    WeeklyCompletion.tsx  weekly completion mini bars (last 7 days, tooltips)
    StatTile.tsx      glass stat tile + DeltaChip (arrow chips) + HabitDotName
    RangeSwitch.tsx   segmented sliding accent-pill range switch (40px, equal-width grid segments, translateX pill, short labels under 400px)
    Sparkline.tsx     pure SVG per-habit sparkline with white-ringed end dot
    ScoreLineChart.tsx  multi-line chart: halo glow, dashed grid, glass tooltip
    Heatmap.tsx       custom calendar heatmap (color-mix intensity levels)
    CompletionHistoryChart.tsx  weekly/monthly completion bars + toggle chips
    ColorPicker.tsx, ThemeToggle.tsx, icons.tsx
    ConfirmDialog.tsx  shared portal-rendered confirmation dialog (scrim + glass panel, role=alertdialog, focus trap, Escape cancels, entry animation)
    ProfileBanner.tsx  banner + avatar/camera/progress + name/verified/email + remove photo
    ProfileDetails.tsx details card shell (routes display ↔ edit)
    ProfileDetailsDisplay.tsx  35/65 label-value rows with dashed dividers
    ProfileDetailsEdit.tsx     in-place edit form + sticky Save/Cancel header
  contexts/
    ProfileContext.tsx ProfileProvider wrapping useProfile — shared profile state across Today header, rail avatar, Profile page
  pages/
    Today.tsx         bento: hero rings + weekly bars + habit tiles (optimistic check-ins, date pill, backfill)
    HabitForm.tsx     add/edit habit
    HabitDetail.tsx   /habits/:id — stats, score chart, bars, heatmap
    Overview.tsx      stat tiles + multi-line chart card (chips inside) + sparkline cards
    Settings.tsx      theme, habit archive/restore, account/sign out
    Profile.tsx       /profile — banner + personal details (display/edit), toasts, skeleton/error states
    Login.tsx         Supabase email/password auth
```

DB: `habits` (id, user_id, name, type boolean|numeric, target, unit, freq_times, freq_days, color, sort_order, archived, created_at), `entries` (id, user_id, habit_id, date YYYY-MM-DD, value, unique (habit_id, date)), `profiles` (user_id pk, full_name, date_of_birth, gender, nationality, country, address, phone, avatar_path, updated_at — one row per user, RLS on) and the private `avatars` bucket (2 MB, files at `<user_id>/avatar.webp`; displayed via 1-hour signed URLs). RLS on habits/entries/profiles. `created_at` timestamps are converted to local dates via `dates.ts` before use in score logic. Email lives only in the auth session, never in `profiles`.
