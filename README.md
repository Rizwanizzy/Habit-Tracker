# Habit Tracker

A personal, single-user habit tracking website, inspired by Loop Habit Tracker. Web-first and mobile-first, installable to a phone home screen as a PWA — no native app.

Track habits with one-tap check-ins, streaks, scores, and charts. The UI uses the **Aurora Glass** design system: a soft aurora background, glass cards, and each habit's own color carrying the rings, charts, heatmaps, and tiles. Light and dark themes included.

## Features

- **Today page (bento)** — hero card with concentric progress rings (one per habit, in its own color), a weekly completion bar chart, and responsive habit tiles with a one-tap check ring (pop + burst animation)
- **Optimistic check-ins** — update instantly, roll back with a visible message on sync errors, and backfill any past date via the date pill
- **Habit management** — yes/no or numeric habits (with target + unit), frequency (e.g., 2 times per 7 days), archive/restore with history kept
- **Stats & charts** — glass stat tiles, a glowing gradient score line chart, 10px rounded completion bars, and a 14px-cell calendar heatmap on each habit's detail page; Overview with stat tiles (average score, best habit, needs attention), a glowing multi-line score chart with habit toggle chips, and per-habit sparkline cards
- **Color picker** — preset swatches, native color input, and custom hex per habit; every foreground use stays readable in both themes
- **Auth** — Supabase email/password sign in, session guard, sign out
- **Profile & avatar** — banner with grid pattern and overlapping avatar (camera upload, crop/resize/WebP, remove photo), name with verified badge, "Personal details" card with in-place edit mode and validation, loading/error/toast states
- **Theming** — light/dark via a sliding sun/moon switch; design tokens from `DESIGN.md`

## Tech stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- Supabase (Auth, Postgres with RLS)
- React Router
- Recharts (line, area and bar charts)
- Vitest
- Installable PWA (`vite-plugin-pwa` — manifest + service worker)

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure Supabase** — create a project, then create `.env.local` in the project root:
   ```
   VITE_SUPABASE_URL=<your-project-url>
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
3. **Create the database tables** — run `supabase/schema.sql` in the Supabase SQL editor (creates `habits`, `entries`, `profiles` and the private `avatars` bucket with row-level security enabled). Skip this if your project already has them.
4. **Run the app**
   ```bash
   npm run dev
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and production build |
| `npm test` | Run Vitest unit tests |
| `npm run lint` | Lint with oxlint |

## Project layout

```
src/
  lib/        pure logic (score, dates, color, profile, avatar, supabase client)
  hooks/      data hooks (useHabits, useEntries, useProfile, useAuth, useTheme, useThemeName)
  components/ reusable UI (AppShell, HabitTile, Heatmap, ColorPicker, Profile*, ThemeToggle)
  pages/      Today (bento), Overview, Profile, Settings, HabitForm, HabitDetail, Login
```

## Documentation

- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — full project context: purpose, architecture, feature progress, and conventions
- [`AGENTS.md`](./AGENTS.md) — coding rules enforced in this repo
- [`DESIGN.md`](./DESIGN.md) — the design spec (tokens, typography, components, motion)
- [`supabase/schema.sql`](./supabase/schema.sql) — database schema to run in Supabase

## License

Personal project — no license yet.
