# Habit Tracker

A personal, single-user habit tracking website, inspired by Loop Habit Tracker. Web-first and mobile-first, with a PWA install coming later — no native app.

Track habits with one-tap check-ins, streaks, scores, and charts. Every habit gets its own color, and the whole UI (checkboxes, charts, heatmaps) follows it. Light and dark themes included.

## Features

- **Today page** — one-tap check-in with optimistic updates, streak badge per habit, and easy backfilling of past dates
- **Habit management** — yes/no or numeric habits (with target + unit), frequency (e.g., 2 times per 7 days), archive/restore with history kept
- **Color picker** — preset swatches, native color input, and custom hex per habit
- **Auth** — Supabase email/password sign in, session guard, sign out
- **Theming** — light/dark with a toggle; design tokens from `DESIGN.md`

## Tech stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- Supabase (Auth, Postgres with RLS)
- React Router
- Vitest
- PWA support planned (`vite-plugin-pwa`)

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
3. **Create the database tables** — run `supabase/schema.sql` in the Supabase SQL editor (creates `habits` and `entries` with row-level security enabled).
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
  lib/        pure logic (score, dates, supabase client)
  hooks/      data hooks (useHabits, useEntries, useAuth, useTheme)
  components/ reusable UI (AppShell, HabitRow, ColorPicker, ThemeToggle)
  pages/      Today, Overview, Settings, HabitForm, Login
```

## Documentation

- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — full project context: purpose, architecture, feature progress, and conventions
- [`AGENTS.md`](./AGENTS.md) — coding rules enforced in this repo
- [`DESIGN.md`](./DESIGN.md) — the design spec (tokens, typography, components, motion)
- [`supabase/schema.sql`](./supabase/schema.sql) — database schema to run in Supabase

## License

Personal project — no license yet.
