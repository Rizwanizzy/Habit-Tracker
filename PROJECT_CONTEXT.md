# PROJECT_CONTEXT

> Purpose of this file: give any developer, AI model, or application a complete, current
> understanding of this project — concept, purpose, stack, architecture, features, and
> progress — without reading every source file. **Update this file after every completed task.**
> Last updated: 2026-10-24

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
- Recharts (installed; charts not yet built)
- Vitest for unit tests
- Inter (Google Font) loaded in `index.html`
- Heatmap will be a custom component (not built yet)

## 4. Commands

```
npm run dev     # dev server (http://localhost:5173)
npm run build   # tsc -b && vite build
npm test        # vitest run (10/10 passing)
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
   - `score.ts` — habit score as an exponential moving average (`SMOOTHING_CONSTANT = 0.05`, per-day weight from `freq_times/freq_days`), `currentStreak`, `bestStreak`, `completionRate`, `isDone` (numeric done when `value >= target`); stats only count from habit `created_at`.
   - `dates.ts` — local `YYYY-MM-DD` helpers for `Asia/Kolkata` (`toLocalDateString`, `todayString`, `parseLocalDate`, `addDays`, `daysBetween`). Never `toISOString().slice(0,10)` — UTC date near midnight breaks the IST day.
   - `supabase.ts` — lazy singleton `getSupabase()` from VITE_ env vars, clear error when missing.
   - Tests in `src/lib/dates.test.ts` (midnight boundary) and `src/lib/score.test.ts` (miss after long streak, numeric below target, created mid-range).
3. **Design tokens + theming** — `src/index.css` maps DESIGN.md tokens to Tailwind via `@theme inline`: colors (light on `:root`, dark on `.dark`), typography scale (`text-page-title` 32/700 ... `text-stat` 34px/700), radii (`rounded-card` 16px, `rounded-button` 12px). Class-based dark mode via `@custom-variant dark`; toggle persists to localStorage; pre-paint script in `index.html` prevents flash.
4. **App shell + auth** (`src/components/`, `src/hooks/`, `src/pages/`):
   - `AppShell.tsx` — bottom navigation (mobile) / sidebar (desktop); content max ~800px centered.
   - `useAuth.ts` — session state live via `onAuthStateChange`.
   - `RequireAuth.tsx` — guard; redirects to `/login` when signed out; loading state while checking.
   - `Login.tsx` — Supabase email/password sign in + create account; navigates to `/` on success (bug fixed: Login sits outside the guard so it must navigate itself).
   - `ThemeToggle.tsx` — light/dark toggle, in Settings page.
   - Login works end-to-end against the user's Supabase project.
5. **Habit tracking features** (latest):
   - `supabase/schema.sql` — `habits` + `entries` tables, RLS on, per-user policies, unique `(habit_id, date)`. **User still needs to run this in the Supabase SQL editor.**
   - `useHabits.ts` — fetch active/all habits (`sort_order` order), `createHabit`, `updateHabit`, optimistic `archiveHabit` with rollback; `extractError` helper.
   - `useEntries.ts` — entries grouped per habit (last 365 days), `saveEntry` (upsert on `habit_id,date`), `removeEntry`.
   - **Today page** — one-tap check-in (optimistic, rollback + visible error), habit-colored checkbox/name/streak badge (streak via `currentStreak`), backfill control (‹ Prev + date picker + Today button), numeric value chip with inline input, loading/empty/error states, gentle >7-habits warning.
   - **HabitForm page** (`/habits/new`, `/habits/:id/edit`) — name, yes-no/numeric type (target + unit), frequency (times per N days), ColorPicker.
   - **ColorPicker component** — 10 preset swatches + native `<input type="color">` + hex text field.
   - **Settings page** — Appearance (theme toggle), Habits (Archive / Restore, archived history kept), Account (email + Sign out).

### Not yet built (planned next)
- **Overview page** — score line chart + calendar heatmap + stat tiles (Recharts); per-habit toggle chips.
- **Habit detail page** (`HabitDetail` in DESIGN.md) — overview stats, score chart, calendar heatmap, best streaks.
- **Calendar heatmap** — custom component; intensity via `color-mix(in srgb, <color> N%, transparent)`.
- **Supabase schema applied** — user must run `supabase/schema.sql` in the SQL editor before habit features work end-to-end.
- PWA (`vite-plugin-pwa`, later).

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

## 7. Architecture overview

```
src/
  main.tsx            entry — applies stored/system theme, renders <App/>
  App.tsx             BrowserRouter routes (/login outside guard; /, /overview, /settings,
                      /habits/new, /habits/:id/edit inside RequireAuth + AppShell)
  index.css           Tailwind v4 + design tokens (@theme) + dark class strategy
  lib/
    score.ts          pure score/streak/completion logic (SMOOTHING_CONSTANT)
    dates.ts          Asia/Kolkata local date helpers
    supabase.ts       lazy Supabase client (getSupabase)
  hooks/
    useAuth.ts        session via onAuthStateChange
    useTheme.ts       dark toggle + persistence
    useHabits.ts      habits CRUD/archive + loading/error
    useEntries.ts     entries per habit + save/remove
  components/
    AppShell.tsx      bottom nav (mobile) / sidebar (desktop)
    RequireAuth.tsx   auth guard
    Login.tsx is in pages; components: HabitRow, ColorPicker, ThemeToggle, icons
  pages/
    Today.tsx         check-ins + backfill
    HabitForm.tsx     add/edit habit
    Overview.tsx      placeholder (charts to come)
    Settings.tsx      theme, habit archive/restore, account/sign out
    Login.tsx         Supabase email/password auth
```

DB: `habits` (id, user_id, name, type boolean|numeric, target, unit, freq_times, freq_days, color, sort_order, archived, created_at) and `entries` (id, user_id, habit_id, date YYYY-MM-DD, value, unique (habit_id, date)). RLS on both. `created_at` timestamps are converted to local dates via `dates.ts` before use in score logic.
