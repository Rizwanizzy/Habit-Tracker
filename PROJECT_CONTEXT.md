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
npm test        # vitest run (19/19 passing)
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
   - `supabase.ts` — lazy singleton `getSupabase()` from VITE_ env vars, clear error when missing.
   - Tests: `dates.test.ts` (midnight boundary), `score.test.ts` (miss after long streak, numeric below target, created mid-range), `color.test.ts`. **19 tests passing.**
3. **Aurora Glass redesign (in progress, UI-only — no logic/DB changes):**
   - **Done:** `index.css` rewritten to DESIGN.md §1/§3/§4 tokens (aurora bg, glass recipes, Space Grotesk/DM Sans, radii shell 28→32 scale, caption uppercase); `src/lib/color.ts`; **`AppShell.tsx` rebuilt** — floating rounded shell (inset 16px, max 1280px, radius 32px) with a 72px circular icon rail on desktop (active = accent-gradient + glow; theme + sign-out circles at rail bottom, sign-out navigates to /login); mobile = floating glass bottom dock (64px, 16px inset, safe-area padding, active = gradient circle); `index.html` loads the new fonts and `viewport-fit=cover`.
   - **Done — Today page bento (DESIGN.md §8):** header with page title + date caption, glass date pill (‹ › arrows + native calendar input + Today shortcut, never lets you navigate past today), gradient 48px "Add habit" pill. Row 1: hero card (5 cols) with `ProgressRings` — concentric rings, one per habit (outermost = first, max 7, stroke 10/gap 6, tint 12% tracks), draw-in 900ms then morph on check-in 700ms; center shows `done / total` (tabular) + caption; motivational line + longest-streak flame chip. Weekly card (7 cols) with `WeeklyCompletion` — last 7 days, one bar per day = share of eligible habits done (habits only count from their `created_at`), native tooltip per bar, today's bar highlighted with glow, draw-in + 40ms stagger, empty state text. Row 2: `HabitTile` grid (1 col mobile / 2 tablet / 3 desktop) — min 132px, `linear-gradient(145deg, tint 22%, tint 6%)` bg, tint 35% border (70% on hover + 2px lift), 44px check ring (pending = 2px habit ring; done = fill + tint glow + white check) with ring-pop (280ms) and burst of 6 habit-colored dots, name in text-fg (habit color never used for body text), flame streak chip in `readableColor`, numeric tiles show a 6px progress bar + "12 / 30 min" (unit once, tap to open inline value input — save/cancel), edit pencil hover-visible (always on mobile). Motion utilities in `index.css`: `ring-pop`, `burst-dot`, `bar-in`, `fade-up` (staggers via animationDelay), `.habit-tile` hover recipe, `.ring-progress`/`.ring-draw`; all collapse under `prefers-reduced-motion`. New files: `components/ProgressRings.tsx`, `components/WeeklyCompletion.tsx`, `components/HabitTile.tsx` (replaces deleted `components/HabitRow.tsx`), `hooks/useThemeName.ts` (reactive dark/light for `readableColor`, listens to the `themechange` event; existing hooks untouched).
   - **Remaining passes:** Heatmap (14px cells / 4px gap), charts (glow, dashed grid, tooltips glass style), Overview stat tiles + bento, Settings two-column, Login glass card, count-up numerals.
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
7. **Overview page** — multi-line score chart (Recharts `LineChart`): one smooth 2.5px line per active habit in that habit's color, per-habit toggle chips that show/hide lines (doubled as chart legend, chip style per DESIGN.md), and a neutral range switch (30 days / 90 days / 1 year). Score series are merged per date (later-created habits' lines start at their creation). Custom multi-row tooltip with habit-colored dots; loading / error / empty states.

### Remaining next steps (Aurora Glass passes still to do)
- All main pages are implemented and the PWA is live (manifest + generated service worker, auto-update). What's left is per-page/component restyling to DESIGN.md: Heatmap (14px cells / 4px gap), charts (glow, dashed grid, glass tooltips — e.g. `CompletionHistoryChart` bars are ~14px, DESIGN.md wants 10px), Overview stat tiles + bento, Settings two-column, Login glass card, count-up numerals.

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
  App.tsx             BrowserRouter routes (/login outside guard; /, /overview, /settings,
                      /habits/new, /habits/:id/edit, /habits/:id inside RequireAuth + AppShell)
  index.css           Tailwind v4 + design tokens (@theme) + dark class strategy
  lib/
    score.ts          pure score/streak/completion logic (SMOOTHING_CONSTANT)
    dates.ts          Asia/Kolkata local date helpers
    supabase.ts       lazy Supabase client (getSupabase)
    color.ts          readableColor / tint / contrast (WCAG-3:1 habit color visibility)
  hooks/
    useAuth.ts        session via onAuthStateChange
    useTheme.ts       dark toggle + persistence (dispatches `themechange`)
    useThemeName.ts   reactive dark/light for readableColor (listens to `themechange`)
    useHabits.ts      habits CRUD/archive + loading/error
    useEntries.ts     entries per habit + save/remove
  components/
    AppShell.tsx      floating shell: icon rail (desktop) / glass dock (mobile)
    RequireAuth.tsx   auth guard
    HabitTile.tsx     Today habit tile (check ring + burst, streak chip, progress)
    ProgressRings.tsx hero concentric rings (one per habit, draw-in + morph)
    WeeklyCompletion.tsx  weekly completion mini bars (last 7 days, tooltips)
    Heatmap.tsx       custom calendar heatmap (color-mix intensity levels)
    CompletionHistoryChart.tsx  weekly/monthly completion bars + toggle chips
    ColorPicker.tsx, ThemeToggle.tsx, icons.tsx
  pages/
    Today.tsx         bento: hero rings + weekly bars + habit tiles (optimistic check-ins, date pill, backfill)
    HabitForm.tsx     add/edit habit
    HabitDetail.tsx   /habits/:id — stats, score chart, bars, heatmap
    Overview.tsx      multi-line score chart + range switch + habit toggle chips
    Settings.tsx      theme, habit archive/restore, account/sign out
    Login.tsx         Supabase email/password auth
```

DB: `habits` (id, user_id, name, type boolean|numeric, target, unit, freq_times, freq_days, color, sort_order, archived, created_at) and `entries` (id, user_id, habit_id, date YYYY-MM-DD, value, unique (habit_id, date)). RLS on both. `created_at` timestamps are converted to local dates via `dates.ts` before use in score logic.
