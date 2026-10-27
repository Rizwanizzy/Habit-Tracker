# Habit Tracker

Personal, single-user habit tracking website, inspired by Loop Habit Tracker. Web app first; installable to a phone home screen later as a PWA. No native mobile app.

Read DESIGN.md before building or changing any UI.

## Stack (do not add other libraries without asking)
- Vite + React 19 + TypeScript (strict mode)
- Tailwind CSS v4 via the `@tailwindcss/vite` plugin. Use `@import "tailwindcss"` in the CSS file. There is no `tailwind.config.js`; define design tokens as CSS variables and `@theme`.
- Supabase (Auth, Postgres, RLS) via `@supabase/supabase-js`
- Recharts for line and bar charts
- React Router for pages
- Vitest for tests
- `vite-plugin-pwa` (added later)
- `@vite-pwa/assets-generator` (dev dependency, one-off icon generation only)
- Heatmap is a custom component, not a library.
- Drag-and-drop reordering: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (approved)

## Commands
- `npm run dev` start dev server
- `npm run build` type-check and build
- `npm test` run Vitest
- `npm run icons` generate PWA icons and favicons from `public/logo.png` (uses `@vite-pwa/assets-generator`, see `pwa-assets.config.js`)

## Folder structure
- `src/lib/` pure logic: `score.ts`, `dates.ts`, `clock.ts`, `supabase.ts`, `color.ts`, `profile.ts`, `avatar.ts`, `order.ts`, `rings.ts`, `completion.ts`, `backup.ts`
- `src/hooks/` data hooks (`useHabits`, `useEntries`, `useTheme`, `useProfile`, `useUserSettings`, `useLogicalToday`, `useBackup`)
- `src/contexts/` React context providers (`ProfileContext` shares profile state across Today header, rail avatar, and Profile page; `SettingsContext` shares the day-start setting; `HabitsContext` shares the habit list)
- `src/components/` reusable UI (HabitRow, Heatmap, ScoreChart, ColorPicker, TodayGreeting, RangeSwitch, ProfileBanner, ...)
- `src/pages/` Today, Overview, HabitDetail, WeeklyReview, Settings, Login, Profile
- `scripts/` one-off scripts (`generate-icons.mjs` - superseded by `pwa-assets.config.js` + `npm run icons`)
- `public/` favicon.ico, favicon.svg, logo.png, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, icons.svg
- Keep files under about 200 lines; split when larger.

## Data model
- `habits`: id, user_id, name, type ('boolean' | 'numeric'), target, unit, freq_times, freq_days, color (hex), sort_order, archived, created_at
- `entries`: id, user_id, habit_id, date (YYYY-MM-DD), value, unique (habit_id, date)
- RLS is on for both tables. Never disable it. Never use the service role key in the frontend.
- `profiles`: user_id (pk, = auth.users id), full_name, date_of_birth, gender ('female'|'male'|'other'|'prefer_not_to_say'), nationality, country, address, phone, avatar_path, updated_at. One row per user, created on first save (upsert). RLS on.
- `user_settings`: user_id (pk), day_start_hour (smallint 0..6, default 0), updated_at. One row per user, created on first save (upsert). RLS on.
- Storage bucket `avatars` (private, 2 MB, jpeg/png/webp). Files live at `<user_id>/avatar.webp`. Store only the path in `profiles.avatar_path`; display with `createSignedUrl` (1 hour) and refresh when expired. Email is read from the auth session, is shown read-only, and is never stored in `profiles`.

## Rules that matter
1. **Colors:** every habit has its own `color` hex from the database. All charts, heatmaps, checkboxes and badges must read it from the habit. Never hardcode a habit color. Heatmap intensity levels use `color-mix(in srgb, <color> N%, transparent)`.
2. **Color picker:** preset swatches plus a native `<input type="color">` for any custom hex. Changing a color updates everything immediately.
3. **Dates:** the app works in "logical days": local `YYYY-MM-DD` in Asia/Kolkata, shifted by the user's day-start hour (`user_settings.day_start_hour`, 0 to 6, default 0). Use the helpers in `src/lib/dates.ts` (`logicalToday`, `toLogicalDateString`). Never use `toISOString().slice(0,10)`. The time-of-day greeting uses the real clock, and everything else uses `clock.now()` so dev time-travel works.
4. **Score logic** lives only in `src/lib/score.ts` as pure functions with unit tests. It must never import React or Supabase.
   - Habit score is an exponential moving average over daily entries: each day moves the score toward 1 (done) or 0 (missed), with a weight based on the habit's frequency (`freq_times` per `freq_days`). Keep the smoothing constant in one named constant so it can be tuned.
   - Also provide current streak, best streak, and completion rate for a date range.
   - A habit's score and stats only count from its `created_at` date onward.
   - Numeric habits count as done when `value >= target`.
5. **Check-ins** are one tap, optimistic (update the UI first, then sync, roll back on error). Backfilling past dates must be easy.
6. **Habit limit:** warn gently when the user has more than 7 active habits. The progress rings always use at most 7 rings; beyond 7 habits the rings are shared (see rule 8).
7. **Archived habits:** hidden from Today and Overview but their history is kept.
8. **Habit order:** `habits.sort_order` ascending, ties by `created_at`, is the single source of truth. Every view that lists habits (Today tiles, progress rings, Overview chips and lines, Settings list) must use the ordered list from `useHabits` and never re-sort on its own. New habits get `sort_order = max + 1`. Ring order follows habit order from the outside in. With more than 7 habits, the first habits share the outer rings (up to 4 per ring, equal arcs) and the last k = min(6, floor((28 - n) / 3)) habits each get a full inner ring, as implemented in src/lib/rings.ts.
9. **PROJECT_CONTEXT.md (always do this):** maintain a `PROJECT_CONTEXT.md` file that documents everything done in the project so far — concept, purpose, stack, features, current progress, and how things fit together — so any other AI model or application can read it and fully understand the project. After completing each task, check that `PROJECT_CONTEXT.md` is up to date and update it if it is not. Also maintain a `README.md` for GitHub.


## UI rules
- Mobile-first; every page must work at 360px wide and scale up cleanly.
- Support light and dark themes using CSS variables from DESIGN.md.
- Tap targets at least 44px. Show loading and empty states on every page.
- Charts must have a tooltip, readable axis labels, and a toggle per habit on the Overview page.

## Code style
- Functional components and hooks only. Named exports. No `any`.
- Handle Supabase errors explicitly and show a visible message; never swallow them.
- Keep logic out of components when it can be a pure function.

## Testing
- All of `src/lib/score.ts` and `dates.ts` needs Vitest coverage, including: a miss after a long streak, a numeric habit below target, a habit created mid-range, and dates around midnight.
- Run `npm test` and `npm run build` after every change and fix failures before finishing.

## Don't
- Don't add payments, social features, or multi-user features.
- Don't commit `.env.local` or any keys.
- Don't change the database schema without telling me and showing the SQL.
- Don't change `src/lib/score.ts` or `src/lib/dates.ts` unless the task says so explicitly; any change there needs new or updated tests.
- Don't rewrite files unrelated to the task.