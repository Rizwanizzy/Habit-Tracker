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
- **Light theme "liquid glass" (light only, scoped `:root:not(.dark)` — dark untouched):** pastel aurora over #E6EEF8 (4 radial glows) + two fixed 420px blurred orbs (lavender top-right, sky-blue bottom-left; blur 80px, opacity .5, behind all content, 24s ease-in-out alternate drift, static under reduced motion). Glass fills become a 145° gradient (white .62→.34) with blur(24px) saturate(180%), 1px rgba(255,255,255,.75) rims, inset highlights + indigo drop shadow; `.app-shell` adds a 1px gradient border (white→sky→lavender, mask trick) + stronger outer glow; habit tiles mix their color toward white (20%/7% fill, 35% border) with a habit-colored shadow; inner rows fill 40% white, controls 55%; light text tokens #0F172A/#475569/#64748B (≥4.5:1). Backdrop-filter fallback: flat rgba(255,255,255,.92). See DESIGN.md §1 "Light theme glass".
- Accent utilities: `.bg-accent-gradient` (135° gradient token) and `.glow-accent` (soft accent shadow). Dark: `#7C83FF→#22D3EE`; light: `#4F46E5→#0EA5E9`.
- Typography: `text-page-title` 32/40, `text-hero` 56/56 tabular-nums (Space Grotesk), `text-section-title` 18/24, `text-habit-name` 17/24, `text-body` 15/22, `text-caption` 12/16 uppercase with .08em tracking. Display font auto-applied to these utilities.
- Radii: shell 32 (`rounded-shell`), cards 28 (`rounded-card`), tiles 24 (`rounded-tile`), inputs 16 (`rounded-input`), pills full (`rounded-pill`).
- Habit color rules (§2): habit colors carry rings, bars, charts, heatmaps, tiles (via `tint()`), and glows — never body text. `readableColor(hex, theme)` in `src/lib/color.ts` guarantees ≥3:1 contrast against the glass surface for every foreground use.
- Motion helper: `prefers-reduced-motion` collapses animations/transitions globally in CSS.

## 4. Commands

```
npm run dev     # dev server (http://localhost:5173)
npm run build   # tsc -b && vite build
npm test        # vitest run (77/77 passing)
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
   - `order.ts` — habit ordering engine (pure, ✅ `order.test.ts`): `compareOrder`/`sortHabits` (sort_order asc → created_at asc → id asc, missing sort_order counts as 0 so legacy all-zero rows stay deterministic), `moveHabit(list, activeId, overId)` (new array, unknown ids/same position = untouched input), `diffOrder(before, after)` → only the `{ id, sort_order }` pairs whose position changed, numbered from 1.
   - `avatar.ts` — `prepareAvatar(file)`: rejects non-images and files over 2 MB, center-crops to a square, resizes to 512px, encodes as WebP via canvas, returns a Blob. Browser-only (canvas).
   - `supabase.ts` — lazy singleton `getSupabase()` from VITE_ env vars, clear error when missing.
   - Tests: `dates.test.ts` (midnight boundary), `score.test.ts` (miss after long streak, numeric below target, created mid-range), `color.test.ts`, `profile.test.ts` (validation + initials), `order.test.ts` (first→last, last→first, same position, unknown ids, legacy all-zero rows). **All passing.**
3. **Aurora Glass redesign (in progress, UI-only — no logic/DB changes):**
   - **Done — Aurora Glass redesign (in progress, UI-only — no logic/DB changes):**
   - **Done:** `index.css` rewritten to DESIGN.md §1/§3/§4 tokens (aurora bg, glass recipes, Space Grotesk/DM Sans, radii shell 28→32 scale, caption uppercase); `src/lib/color.ts`; **`AppShell.tsx` rebuilt** — floating rounded shell (inset 16px, max 1280px, radius 32px) with a 72px circular icon rail on desktop (logo mark at top, clickable → Today; Today/Overview/Settings in middle — Today reached via logo click since `/` is the default route; Profile avatar alone in the bottom group (NavLink, accent ring when /profile is active; no theme toggle in the rail — the theme switch lives in Settings); sign-out removed from rail, now on Profile header as an icon button opening `ConfirmDialog`); mobile = floating glass bottom dock (64px, 16px inset, safe-area padding, 3 items: Today, Overview, Settings); `index.html` loads the new fonts and `viewport-fit=cover`. **Cursor pointer rule added to `@layer base`** so all buttons, links, role="button" etc. show hand cursor; hover states + focus rings added to rail icons, theme toggle, range switch segments, habit check rings, color swatches, chips, and the sign-out icon.
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
   - `useHabits.ts` — the shared habit store hook (all habits for the user, consumed through `HabitsContext` so every page sees one list). Always returns the list through `sortHabits` (rule 8; DB `order('sort_order')` removed — JS order is the source of truth). `createHabit` sets `sort_order = max + 1` (first habit = 1), `updateHabit`, optimistic `archiveHabit` with rollback, and `reorderHabits(orderedIds)`: optimistic renumber 1..n by drag position, save only `diffOrder` rows via one `update({sort_order}).eq('id')` each in `Promise.all` (never upsert), roll back to the previous order and expose `reorderError` on failure. Also `extractError` helper.
   - `useEntries.ts` — entries grouped per habit (last 365 days), `saveEntry` (upsert on `habit_id,date`), `removeEntry`.
   - **Today page** — superseded by the Aurora Glass bento described in item 3 above (same data flow: optimistic one-tap check-in with rollback, inline numeric value input, loading/empty/error states, gentle >7-habits warning).
   - **HabitForm page** (`/habits/new`, `/habits/:id/edit`) — name, yes-no/numeric type (target + unit), frequency (times per N days), ColorPicker.
   - **ColorPicker component** — 10 preset swatches + native `<input type="color">` + hex text field.
   - **Settings page** — Appearance (theme toggle), Habits (Archive / Restore, archived history kept), Account (email + "View profile" link).
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
   - **Settings** — two-column desktop grid (Appearance + Account left, Habits right), glass cards with fade-up stagger, habit rows use surface-raised pills with a color dot, name links to the edit page, pencil icon button, glass pill Archive/Restore, "N active · M archived" caption, sign-out done only on the Profile header.
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
    - Components: `ProfileBanner.tsx` (full-width grid background banner 120/160px with `.banner-grid` 56px square-grid pattern + radial mask-image fade toward bottom/sides, no glass-card/border/radius; avatar 96/120px sitting inside the grid ~24px from top with 4px `ring-bg-base`, accent glow, initials fallback; 36px camera button opening a keyboard-accessible glass popover with "Change photo" and "Remove photo" — the latter only when a photo exists, with a confirmation step via `ConfirmDialog`; popover closes on outside click and Escape; name 32/40 + blue verified badge (22px desktop / 18px mobile) via `VerifiedBadge` component when email confirmed; name + badge in one inline-flex row with name truncating; email below centered with user icon); `ProfileDetails.tsx` + `ProfileDetailsDisplay.tsx` + `ProfileDetailsEdit.tsx` (28px-radius glass card: header separated by 1px border with a subtle 36px ghost/outline Edit pill; rows 35%/65% label/value stacked on mobile with dashed dividers and "Not added" for empties; edit mode = 52px `.input-field` inputs in place, Gender via `RangeSwitch` with a new optional `dense` prop (caption-size text for 4 options; null maps to `prefer_not_to_say`), DOB `type=date` capped at today, phone `type=tel`, email read-only with lock icon; Save (48px primary) and Cancel (secondary) replace Edit in the same sticky card-header spot, per-field inline validation errors from `validateProfile`).
    - `pages/Profile.tsx` — breadcrumb header "My Account / Profile" (no action pill; sign-out icon on the right opens `ConfirmDialog` danger variant); skeleton shimmer via `.skeleton`; page-level error card with Retry only when `error && !profile` (save/upload failures surface as toasts instead); toasts fixed-bottom auto-dismiss 2.6s ("Profile saved" / upload/remove/save errors via `extractError`).
    - `src/components/ConfirmDialog.tsx` — shared portal-rendered confirmation dialog: renders scrim + glass panel into `document.body` via `createPortal`; scrim `rgba(4,6,14,0.55)` dark / `rgba(15,23,42,0.28)` light with `backdrop-filter: blur(10px) saturate(120%)`; panel glass `min(480px, calc(100vw-32px))`, radius 28px, theme-specific gradients/borders/shadows, `backdrop-filter: blur(28px) saturate(150%)`, `@supports not (backdrop-filter)` opacity 0.94 fallback; top accent line; title 22px; description 15px sentence case; Cancel ghost pill + danger confirm pill (44px high); `role="alertdialog"`, focus trap, Escape cancels, focus returns to opener, body scroll lock, scale+fade entry 200ms (disabled under prefers-reduced-motion).
    - `src/components/VerifiedBadge.tsx` — inline SVG verified badge: blue scalloped seal (`r(theta) = 10 + 1.1 * cos(8 * theta)`, 120 points, computed once as constant) with `linearGradient` from #4DA6FF to #1D7CF2, white checkmark stroke 2.4 round caps/joins, `drop-shadow` glow, `role="img"`, `aria-label="Verified"`, props `size` (default 22) + `className`.
    - Nav: Profile is accessed via the avatar in the Today header (navigates to /profile) and via the "View profile" link in Settings; not in the rail or mobile dock. /profile route added inside RequireAuth; icons gained IconUser, IconCamera, IconLock; CSS gained .banner-grid, .banner-bg (radial mask fade), @keyframes spin + .progress-spin, @keyframes shimmer + .skeleton, dialog-scrim/dialog-panel/dialog-accent-line (reduced-motion covered by the global rule).
    - Note: the edit header uses `sticky top-2`; the shell's `overflow-hidden` wrapper may prevent it from engaging on scroll (best-effort); layout covers 360px and 1440px in both themes.
    - DB field `country` is included as a row in both display and edit modes so `save` never nulls it.
12. **Light theme "liquid glass" pass (light only — every rule scoped `:root:not(.dark)`, dark theme byte-identical):**
    - **Background:** light `--bg-base` → #E6EEF8; light `--bg-aurora` → 4 pastel radials (sky .75 top-left, lavender .65 top-right, peach .55 bottom-right, mint .55 bottom-left, each fading to transparent 70%). Two fixed 420px orbs via `body::before/::after` (lavender #A78BFA top-right, sky #38BDF8 bottom-left; blur 80px, opacity .5, `z-index:-1`, `pointer-events:none`; `orb-drift` 24s ease-in-out alternate — collapsed to static by the global reduced-motion rule).
    - **Glass:** `:root:not(.dark) .glass-card/.glass-pill` — 145° gradient rgba(255,255,255,.62→.34), blur(24px) saturate(180%), rim rgba(255,255,255,.75), box-shadow inset white top + inset indigo bottom + 0 24px 60px -24px rgba(79,70,229,.28) + 0 2px 6px rgba(15,23,42,.04). `@supports` no-backdrop fallback → flat rgba(255,255,255,.92).
    - **Shell:** new `.app-shell` class on the AppShell div; light gradient border via `::before` (mask-composite exclude, white→rgba(125,211,252,.6)→rgba(196,181,253,.6)) + outer 0 40px 100px -30px rgba(79,70,229,.30).
    - **Habit tiles (`HabitTile.tsx`):** light branch renders tile fill/border with `color-mix(<habit> 20/7/35%, white)` (dark keeps the `tint()` transparents); new inline `--tile-glow` var (habit 55%) consumed by the light tile shadow 0 16px 36px -18px. Dark branch unchanged.
    - **Rows & controls:** `.bg-surface-raised` light = rgba(255,255,255,.40) + rgba(255,255,255,.6) rim; `.bg-surface`/`.input-field` = rgba(255,255,255,.55), white border, inset top highlight; explicit focus border-color rules so `focus:border-accent` still wins over the unlayered light overrides; input focus ring gains the soft glow. `hover:bg-surface(-raised)` hover fills overridden light-only too.
    - **Depth/text:** `.glow-accent` light → 0 10px 28px -8px rgba(79,70,229,.55); light text tokens #0F172A / #475569 / #64748B (all ≥ 4.5:1 on the glass), light `--chart-axis` → #64748B. ConfirmDialog `.dialog-panel` light recipe matches the glass (gradient, blur 24/180, white rim) with the .92 fallback; `.dialog-scrim` unchanged.
    - **Docs:** DESIGN.md §1 light column + "Light theme glass" note added (surface gradient rows/chrome cells, glass rims, orbs, tile mixes, fallback).
    - No changes to `src/lib`, `src/hooks`, or the DB; no layout/size/animation changes.
13. **Nav + Settings simplification (user request):**
    - **Rail:** desktop rail bottom group is now the Profile avatar alone — the theme toggle button was removed (the Settings Appearance card is the only theme switch). Cleaned up now-unused imports in `AppShell.tsx` (`useTheme`, `IconSun`, `IconMoon`). Mobile dock unchanged (Today / Overview / Settings).
    - **Settings:** Account card trimmed to signed-in email + "View profile" link; the Sign out button (and its `signOut`/`signOutError` logic + `getSupabase` import) was removed — sign-out stays only on the Profile header via the `ConfirmDialog` danger flow.
14. **Shared habit order + reorder engine (no DB/schema changes; `sort_order` column already exists):**
    - `src/lib/order.ts` (pure, 13 tests): `sortHabits` (sort_order asc → created_at asc → id asc; missing sort_order = 0 so legacy all-zero rows order by created_at then id), `moveHabit(list, activeId, overId)` (dnd-kit-shaped move; unknown ids / same position return the input untouched), `diffOrder(before, after)` (only changed `{id, sort_order}` pairs, numbered from 1). `score.ts`/`dates.ts` untouched.
    - `HabitsProvider`/`useHabitsContext` (`src/contexts/HabitsContext.tsx`) mounts inside RequireAuth around `AppShell`; fetches all habits once (archived included) and shares one list — Today, hero/progress rings, Overview and Settings all read it (Today/Overview filter archived client-side; views never re-sort).
    - `useHabits` rewrite: fetch goes through `sortHabits`; `createHabit` uses `sort_order = max(existing)+1` (first habit = 1); new `reorderHabits(orderedIds)` — optimistic renumber 1..n first, then save only changed rows via one `update({sort_order}).eq('id', id)` per row with `Promise.all` (upsert avoided on purpose), rollback + `reorderError` on failure. Failures are exposed, not thrown.
    - `HabitForm` calls shared `reload()` after create/edit so the shared list is fresh when navigating back. `App.tsx` wraps the shell route in `HabitsProvider`.
    - Drag-and-drop packages (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) are approved (AGENTS.md) but not installed yet — the drag UI on Today tiles is the next pass; the ordering engine above is its backend.
15. **Today reorder (jiggle) mode (UI-only; `src/lib` + `src/hooks` untouched):**
    - `HabitReorderGrid.tsx` (extracted so Today stays lean): DndContext with MouseSensor + TouchSensor and KeyboardSensor with `sortableKeyboardCoordinates`; SortableContext with `rectSortingStrategy` over the ordered active habits; `DragOverlay` showing a `.tile-dragged` copy (1.04 scale + stronger `--tile-glow` shadow). **The DragOverlay is rendered through `createPortal(…, document.body)`** — the shell's `.glass-card.app-shell` wrapper carries `backdrop-filter`, which creates a containing block for `position: fixed` descendants and would anchor the overlay to the shell box (top of the page when scrolled); outside the shell the overlay sits above the dock (dnd-kit default `zIndex` 999) with `pointerEvents: none`, keeps the theme tokens (the `.dark` class lives on `<html>`), and has its size set from the active tile's measured rect (`active.rect.current.initial`, applied both by dnd-kit itself and explicitly in `style`). Autoscroll stays enabled via `autoScroll={{ threshold: { x: 0, y: 0.2 }, acceleration: 10 }}` (window is the scroll container — `main` is not its own scroller); the list gets `pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0` so the dock never covers the last tile. Activation constraint is mode-dependent — `{ delay 350ms, tolerance 8 }` outside the mode (the long-press that enters it), `{ distance: 4 }` inside so drags feel immediate. Reordering the sensors on mode change is safe: dnd-kit's `useSensorSetup` effect only depends on the sensor classes and sensors are instantiated with current options at activation time. The long-press starts the drag AND enters jiggle mode via `onDragStart` (`navigator.vibrate?.(12)` on enter and drop); the mode stays on until Done/Escape. A drop sets a shared `swallowClickUntil` window (Date.now() + 150) before saving.
    - `SortableHabitTile.tsx`: wrapper `<li>` owns the sortable ref/transform (so the tile inside keeps its own jiggle animation — element separation avoids transform conflicts); `useSortable` has NO `disabled` option and attributes/listeners are spread unconditionally, so `aria-roledescription="sortable"`, `role="button"` and `tabIndex` are always present and long-press can always activate a drag; a `swallowClickRef` capture-phase click handler eats the synthetic click that trails a drop; context menu prevented in mode; `draggable={false}` forfeits native image/link drag.
    - `HabitTile.tsx`: root is now a `<div class="habit-tile">` (the sortable `<li>` owns the motion); `reorderMode` disables + dims check/edit/name/value controls (`disabled`/`tabIndex -1`/`pointer-events-none`/`opacity-60`), inline numeric editor never opens in mode; negative per-tile `animationDelay` desyncs the wiggle; `overlay` flag skips fade-up; `h-full` for grid row stretch.
    - CSS (`index.css`, end-of-file section): `@keyframes tile-jiggle` (±1.2°, 140ms ease-in-out infinite alternate — tiles desynced via negative delays); `.reorder-grid` grab cursor + user-select/-webkit-touch-callout/touch-action none (no scroll hijack: only in mode); `.tile-ghost` dims the source; `.tile-dragged` themed shadows; reduced-motion swaps the wiggle for a static dashed accent outline (drags keep working).
    - Today header: Add habit → Done (accent gradient pill) + "Drag to reorder" caption in mode; Escape and Done exit. Toasts (same pattern as Profile): "Order saved" after a successful drop, danger toast for `reorderError` from the hook's rollback; 2.6s auto-dismiss.
    - Rings (item 5 of the spec): `ProgressRings` circles are keyed by habit id and share one r-per-index pitch; `.ring-progress`/`.ring-track` transition `r` at 400ms (plus dashoffset 700ms), so a reorder morphs each ring to its new slot instead of jumping. Overview chips/lines and the Settings list already read the ordered shared list.
    - Tests/build green (57/57). dnd-kit was already in package.json.
16. **Hero rings rework (UI-only — `src/lib/rings.ts`, hooks and DB untouched):** `ProgressRings.tsx` rewritten to consume the ring library — `layoutRings(habitIds)` gives the rings outermost-first (shared split rings outside, full rings inside when > 7), and each ring's radius comes from its position in that list mapped onto `ringGeometry` (which is innermost-first; `radiusIndex = numRings − 1 − ringIndex`). **Geometry pass 2 (user feedback after the 16-habit look):** the viewBox stays a constant 240; `ringGeometry` no longer reserves 0.4·size for the center — it packs rings edge-to-edge between a `holeMin = max(48, 0.2·size)` free center (≥96px diameter on screen) and the rim, stroke capped at `max(12, 0.05·size)`, gaps at `max(2px, 0.22·stroke)`, with the used span centered in the band (slack opens the hole by `slack/2` and leaves an equal outer margin). Result: strokes ~12px for 1–5 rings, ~10.3px at 6, ~8.6px at 7 (previously 2.6px hairlines), and the hole shrinks monotonically from ~156px (1 ring) down to its 96px minimum (7 rings) — the vacant middle around the center numerals is gone. Numeral scale now: 2.125rem → 1.5rem when `total > 9` or `numRings > 3` → 1.35rem when `numRings > 5`; `stroke-width` joined the 400ms transition list (it steps when the ring count crosses thresholds). New geometry tests (fit-in-box, monotone width/hole, edge-to-edge gaps, exact 7-ring case) keep `src/lib/rings.ts` covered. Every habit renders FLAT at SVG top level, keyed by habit id, regardless of which ring it belongs to, so DOM nodes survive reorders/adds and CSS transitions morph `r`, `stroke-dasharray`, `stroke-dashoffset`, and slice position (rotate transform, `transform-box: fill-box` + `transform-origin: center` in `.ring-arc`) at 400ms, `opacity` 200ms; `.ring-draw` keeps the 900ms first-render draw-in (shared-arc draw grows the dash from `0 X` to its length; full rings keep the old dashoffset mechanism exactly). A ring with 2–4 habits uses `segmentArcs` equal arcs with 6px gaps; painted dashes are trimmed at both ends by `capTrim = min(arcLen/4, width/2 + 1)` so round caps keep a visible ~2px gap between neighbours; each slice has a `tint(color, 12)` track arc and a progress arc (boolean = whole arc when done; numeric fills `value/target` clockwise from the slice start; zero-fraction arcs get `opacity: 0` so no dash-dot artifact). Center text counts **all** active habits (not just the ≤ 28 on the rings): `done / total` with tabular-nums, numeral shrinks to 1.5rem when `total > 9` or `numRings > 3`, caption hidden when `numRings > 5`. **Interaction:** no per-arc hit circles — the SVG root runs a polar picker (`pick()`): pointer coords → svg units via getBoundingClientRect, nearest ring by `|r − radius|` (tolerance `max(24·scale, ring width)` units ≈ ≥24 CSS px), then slice by angle (`atan2` normalized into `[-π/2, 3π/2)` to match segmentArcs ranges, which start at −π/2 = 12 o'clock and grow clockwise in y-down space). Mouse = pointermove hover, touch = pointerdown shows the glass tooltip + 2000ms auto-hide; taps never toggle anything; pointerleave/cancel clears. `RingTooltip.tsx` renders a `glass-pill` anchored at the arc midpoint (percent of the SVG box), flipped above/below depending on the midpoint's half; `aria-hidden`, `pointer-events-none`. Per-habit `<g>` carries `aria-label "<name>: done"` or `"<name>: 3 of 5 min"`; the SVG is `role="img"` with a summary label. Today's >7-habits note replaced: "You have N active habits. Rings are shared from here on (up to 4 habits per ring). Fewer habits are easier to stick to." + "+K more habits are not shown in the rings." when hiddenCount > 0 (Today memoizes `layoutRings` only for that note). Design specs: stroke gets thinner as rings are added (thick for few, ~2.6 CSS px at 7 rings on a 240px box) — intended; hit tolerance covers tap targets.
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
    order.ts          habit ordering engine: sortHabits/moveHabit/diffOrder (pure, numbered from 1)
    rings.ts          ring layout logic: layoutRings/ringGeometry/segmentArcs (pure, MAX_RINGS=7, MAX_PER_RING=4, MAX_HABITS_SHOWN=28) — consumed by the Today hero rings + hidden-count note
    avatar.ts         prepareAvatar: crop/resize/encode WebP via canvas (browser-only)
  hooks/
    useAuth.ts        session via onAuthStateChange
    useTheme.ts       dark toggle + persistence (dispatches `themechange`)
    useThemeName.ts   reactive dark/light for readableColor (listens to `themechange`)
    useHabits.ts      shared habit store: sortHabits-ordered list, CRUD/archive, reorderHabits (optimistic + rollback, reorderError)
    useEntries.ts     entries per habit + save/remove
    useProfile.ts     profile row load/save (upsert), avatar upload/remove, signed URL (1h, auto-refresh)
  components/
    AppShell.tsx      floating shell: icon rail (desktop) / glass dock (mobile); logo mark at rail top (clickable → Today, has focus ring); Overview/Settings in the rail middle; Today/Overview/Settings (3) in the dock; Profile avatar alone at rail bottom (NavLink — accent ring when /profile is active; no rail theme toggle, theme switch is in Settings); rail active states come from NavLink's own isActive (reactive); sign-out on the Profile header
    RequireAuth.tsx   auth guard
    TodayGreeting.tsx greeting block: avatar + time-of-day greeting + "Hi, <name>" + date; avatar links to /profile
    HabitTile.tsx     Today habit tile (check ring + burst, streak chip, progress)
    HabitReorderGrid.tsx  sortable tile grid: 350ms long-press jiggle mode, DragOverlay preview, drop → reorderHabits
    SortableHabitTile.tsx  grid li wrapper for dnd (transforms live here, jiggle on the tile inside)
    ProgressRings.tsx hero rings via lib/rings.ts — shared equal-arc rings ≥ 8 habits (outermost-first), rotate+dasharray morphs keyed by habit id, polar-picker tooltip, center counts all active habits
    RingTooltip.tsx   glass-pill tooltip for the hero ring arcs (habit-color dot + name + status, above/below flip)
    WeeklyCompletion.tsx  weekly completion mini bars (last 7 days, tooltips)
    StatTile.tsx      glass stat tile + DeltaChip (arrow chips) + HabitDotName
    RangeSwitch.tsx   segmented sliding accent-pill range switch (40px, equal-width segments, translateX pill, short labels under 400px via reactive matchMedia hook)
    Sparkline.tsx     pure SVG per-habit sparkline with white-ringed end dot
    ScoreLineChart.tsx  multi-line chart: halo glow, dashed grid, glass tooltip
    Heatmap.tsx       custom calendar heatmap (color-mix intensity levels)
    CompletionHistoryChart.tsx  weekly/monthly completion bars + toggle chips
    ColorPicker.tsx, ThemeToggle.tsx, icons.tsx
    ConfirmDialog.tsx  shared portal-rendered confirmation dialog (scrim + glass panel, role=alertdialog, focus trap, Escape cancels, entry animation)
    VerifiedBadge.tsx  inline SVG verified badge: blue scalloped seal + white checkmark, role=img aria-label Verified
    ProfileBanner.tsx  banner + avatar/camera/progress + name/verified badge/email + remove photo
    ProfileDetails.tsx details card shell (routes display ↔ edit)
    ProfileDetailsDisplay.tsx  35/65 label-value rows with dashed dividers
    ProfileDetailsEdit.tsx     in-place edit form + sticky Save/Cancel header
  contexts/
    ProfileContext.tsx ProfileProvider wrapping useProfile — shared profile state across Today header, rail avatar, Profile page
    HabitsContext.tsx  HabitsProvider wrapping useHabits (all habits incl. archived) — one ordered list for Today, rings, Overview, Settings; mounts inside RequireAuth around AppShell
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
