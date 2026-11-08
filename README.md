# Habit Tracker

A personal, single-user habit tracking website, inspired by Loop Habit Tracker. Web-first and mobile-first, installable to a phone home screen as a PWA — no native app.

Track habits with one-tap check-ins, streaks, scores, and charts. The UI uses the **Aurora Glass** design system: a soft aurora background, glass cards, and each habit's own color carrying the rings, charts, heatmaps, and tiles. Light and dark themes included.

## Features

- **Today page (bento)** — hero card with concentric progress rings (one per habit in its own color; beyond 7 habits the first habits share the outer rings as equal arcs and the rest get full inner rings), a completion card with week / month / year views in a single color you pick, shaded by each day's completion percentage, and responsive habit tiles with a one-tap check ring (pop + burst animation), long-press to enter wiggle reorder mode (drag or rearrange as many tiles as you want, then tap anywhere outside a tile or tap Done to finish), and a user-set tiles-per-row density stepper (1–6). Mobile view features a dedicated app layout: two-row header with avatar, time-of-day greeting, and theme toggle over Row 2 containing the date navigation pill and "Per row" density stepper side-by-side (dynamically splitting width 50%/50% on Today and 65%/35% on past days to fit the date, chevrons, and "Today" button without clipping; powered by a native transparent input overlay preventing iframe `SecurityError`s); a landscape summary card with 38-40px Space Grotesk numerals, motivational line, streak badge, and 120px progress rings showing a center percentage; natural section order (Header -> Date/Density Row -> Hero summary -> Completion card -> Habit tiles); a uniform-height CompletionCard (`h-[236px]` on mobile); clean 16px bottom dock clearance (`pb-[calc(5.5rem+env(safe-area-inset-bottom))]`); and a floating glass dock with center Add-habit FAB (Today/Overview left, Profile/Settings right), with all tap targets ≥44px.
- **Optimistic check-ins** — update instantly, roll back with a visible message on sync errors, and backfill any past date via the date pill
- **Skip a day & Edit habit** — each habit tile features a single "more" menu button (three dots) at the top right, providing quick access to "Edit habit" (navigates to `/habits/:id/edit`) and "Skip <day>" / "Undo skip" across all viewports and density levels (1-6 per row). A skipped day is neutral (the score carries over, streaks neither break nor count it, it's excluded from completion-rate denominators), shows as a muted tile with a "Skipped" caption, and the habit-detail heatmap can tap-cycle empty → done → skipped → empty with a "Skipped" legend
- **Vacation mode** — pause all habits for a while: a Settings switch (or a scheduled break with optional end date, past dates allowed for backfill) puts vacation days over every habit as neutral days — nothing breaks a streak, scores stay flat, completion denominators shrink to counted days, but check-ins you do make still count. Today shows a "Vacation mode · habits are paused" banner with a Resume button, and neutral tiles/heatmap cells carry a "Vacation" caption/legend. Backups include vacation periods (list under "Breaks")
- **Day start** — a check-in made after midnight can still count for the previous day: pick your own day-start hour (midnight to 6 AM) in Settings and every view follows the shifted "logical day". On phones the same anchored popover keeps working with short "12 AM–6 AM" labels, a compact 44px trigger, and collision handling that flips it above the trigger (or scrolls it internally) so it never hides behind the dock.
- **Web Push notifications (in progress)** - daily reminders: browser capability detection,
  permission management requiring explicit user interaction, standalone PWA install guidance
  on iOS Safari (16.4+), service worker push event handling (`push-sw.js`), diagnostic controls
  in Settings, and once permission is granted a compact Reminders card — a single "On/Off" status chip, a Vacation-style daily reminder switch, a time row that dims and locks while the reminder is off, and send-test / device-registration pills —
  with per-device push registration (delivery begins with the upcoming Worker sender;
  `VITE_VAPID_PUBLIC_KEY` is required in the environment).
- **Settings on phones** — the page reflows below 1024px: the Day and Data cards sit side by side (equal-height 50/50), then Vacation and Habits full width. Data drops its caption and shows a compact "Include profile" checkbox over a 2-up row of 40px Export/Import pills (icon beside a one-word label; the card is a CSS size container, so below 166px of card width the pills stack full-width instead); Day shows "Counts as Wednesday November 4" (full date, capped at two lines) so it fills the vacant space the grid stretch already allocates without growing either card; Vacation uses native 50/50 date inputs fixed for iOS Safari (appearance removed so they shrink, 16px text so it never zooms, pad-based sizing so the picked value centers, an overlaid dd-mm-yyyy placeholder while empty) — and habits switch from rows to a two-column tile grid — emoji ring + one-tap archive button per tile, with a dedicated "Archived · n" section. Desktop keeps the exact two-column layout.
- **Backup** — download a JSON backup of all habits (archived included) and every check-in, plus optional profile details (never the photo path or email); the export pages past Supabase's 1000-row request cap, so the backup is complete at any history size. Importing a backup is additive and idempotent: pick the file in Settings → Data, preview what's new (counts, date range, warnings), and choose to overwrite entries, restore the day-start hour, or restore profile details — it never deletes anything, and re-importing the same file changes nothing. Vacation periods ("breaks") ride along in the file and are restored the same way.
- **Habit management** — yes/no or numeric habits (with target + unit), frequency (e.g., 2 times per 7 days), an optional emoji shown inside the check ring (chosen from the **full searchable emoji picker** — every Unicode emoji, categories, skin tones, recents — or typed/pasted) so a habit stays recognisable when its tile is narrow and the name truncates, archive/restore with history kept. The Add/Edit page gets a dedicated **phone layout below 1024px**: a glass back button + 22px title, a 52px name input with a prominent 52px circular emoji trigger (showing a default `"🙂"` visual hint, an accent `+` badge, soft glow, and a subtle entrance pulse when empty), a live **Preview tile** (name, emoji and color, shared with the desktop card), hairline settings rows (compact Type switch, habit-color circle with popover, a numeric-only row with a **daily-target wheel** + unit field, Repeat with two alarm-clock wheel pickers with scroll-snap haptic ticks), and a Cancel + gradient "Create habit"/"Save changes" pair clearing the dock with the exact 12px gap on iPhone Safari — all sharing one form state with the untouched desktop form.
- **Stats & charts** — glass stat tiles, a glowing gradient score line chart, 10px rounded completion bars, and a 14px-cell calendar heatmap on each habit's detail page; Overview with stat tiles (average score, best habit, needs attention — the last two drill into those habits) and a glowing multi-line score chart with habit toggle chips (dynamically scaled on iPhone Safari to maintain the exact 12px gap above the floating dock across expanded/collapsed toolbars)
- **Color picker** — preset swatches, native color input, and custom hex per habit; every foreground use stays readable in both themes
- **Auth** — Supabase email/password sign in, **Sign in with Google** (brand-styled OAuth pill), session guard, sign out
- **Profile & avatar** — banner with grid pattern and overlapping avatar (camera upload; inputs up to 20 MB are compressed to a small 512px WebP, with clear warnings for non-images or oversized files; remove photo), name with verified badge, email, and an optional **motivation line (bio)** up to 140 code points (with inline 140-char textarea editor, single-line sanitization, and ghost button trigger). The page features **"Your journey" lifetime stats** (longest streak with habit indicator, total check-ins across all-time history, 30-day consistency percentage, days tracking) and **"Milestones" badges** (4 streak milestones: 7, 21, 66, 100 days; 4 check-in milestones: 25, 100, 500, 1000 check-ins with animated progress rings for the next locked badge). On desktop (≥1024px), Personal details side (7/12) and Journey + Milestones cards side (5/12) form a balanced 2-column grid.
- **Multi-Theme Appearance System** — 7 distinct appearance options: System (matches OS light/dark), Light (pastel liquid glass), Dark (deep midnight default), Sepia (warm cream & espresso parchment), OLED (pure #000000 midnight black), Solarized (classic Ethan Schoonover palette), and High Contrast (maximum clarity WCAG 2.2 AAA ready with solid borders and cyan accent); accessible via the Today header theme button (with rotating Sun/Moon icon, 1-tap quick toggle, and anchored popover theme selector). Design tokens from `DESIGN.md`.

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
3. **Create the database tables** — run `supabase/schema.sql` in the Supabase SQL editor (creates `habits`, `entries` (+ status), `vacation_periods`, `profiles` (+ bio), `user_settings`, `notification_settings`, `push_subscriptions` and the private `avatars` bucket with row-level security enabled). Safe to re-run on projects that have some of them already.
4. **Google sign-in (optional)** — create an OAuth client in Google Cloud (Web application; authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`), enable Auth → Providers → Google in Supabase with that Client ID/Secret, add `<origin>/login` to Supabase's Redirect URLs, and fill the OAuth consent screen (app name + logo; note the account chooser always shows the supabase.co domain of the redirect URI).
5. **Run the app**
   ```bash
   npm run dev
   ```

## Hosting

The app is a static Vite SPA (all backend work happens in Supabase). Current live deployment: **Cloudflare Pages** — `https://habbits-tracker.pages.dev` (migrated from Vercel in November 2026).

- **Build command** `npm run build`, output `dist`; settings `NODE_VERSION` = 22.
- **Environment variables** (must exist *before* the build — Vite inlines them at build time): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Change them → redeploy.
- SPA routing: Cloudflare Pages auto-enables Single-page-App mode (no `404.html` in the output), so deep links (`/settings`, `/habits/:id`…) survive a refresh. (The `vercel.json` rewrite from the earlier Vercel deployment is no longer used.)
- **Auth wiring for the deployed domain:**
  - Supabase → Auth → URL Configuration → Site URL = the deployed origin; Redirect URLs += `<origin>/login` (keep localhost for dev).
  - Google Cloud → Clients → OAuth client → Authorized JavaScript origins += the deployed origin; the redirect URI stays the Supabase callback.
  - Google Auth Platform → Branding → Authorised domains += the deployed host, with homepage/privacy URLs updated to match (brand verification re-runs against the new domain).
- **Never auth against per-deployment/preview URLs** (`<hash>.<project>.pages.dev` — they change every deploy) as the Site URL or as an auth redirect target. Always open/auth against the stable production domain; if Supabase's Redirect URLs don't include the origin the sign-in was started from, Supabase silently falls back to the Site URL.
- **Dev access over the LAN IP** (phone testing via `http://192.168.x.x:3000`) **cannot use Google sign-in**: Supabase Auth accepts plain-`http://` redirect origins for `localhost` only — any other `http://` origin silently falls back to the Site URL even when it is on the Redirect URLs list. Google sign-in testing over the LAN uses one of: **Chrome port forwarding** (desktop Chrome → `chrome://inspect` → Port forwarding `localhost:3000` over USB, so the phone's browser uses an already-whitelisted `localhost` origin), or email/password sign-in (its return never leaves the dev origin).
- The Google account chooser always shows the Supabase callback domain (`<project-ref>.supabase.co`) because that is the OAuth redirect domain; the consent page itself shows the branding's App name/logo once the app is published to production with a public Application home page (localhost is rejected there).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and production build |
| `npm test` | Run Vitest unit tests |
| `npm run icons` | Generate PWA icons and favicons |
| `npm run lint` | Lint with oxlint |

## Project layout

```
src/
  lib/        pure logic (score, dayStatus, dates, clock, color, profile, order, rings, avatar, backup + backupImport, vacation, wheel, haptics, stats, milestones, supabase client)
  hooks/      data hooks (useHabits, useEntries, useProfile, useAuth, useTheme, useUserSettings, useLogicalToday, useBackup, useImportBackup, useVacations, useLifetimeStats)
  components/ reusable UI (AppShell, HabitTile, TileMoreMenu, HabitReorderGrid, ProgressRings, Heatmap, ColorPicker, DayStartCard, ManageTileMobile (phone Settings tiles), VacationCard, WheelPicker, HabitFormMobile, JourneyCard, MilestonesCard, Profile*)
  contexts/   React context providers (ProfileContext, HabitsContext, SettingsContext, VacationsContext)
  pages/      Today (bento), Overview, Profile, Settings, HabitForm (desktop lg+ + phone layout), HabitDetail, Login, Privacy, Landing
```

## Documentation

- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — current project state: purpose, architecture, features, conventions
- [`CHANGELOG.md`](./CHANGELOG.md) — the numbered history of every pass on the project
- [`AGENTS.md`](./AGENTS.md) — coding rules enforced in this repo
- [`DESIGN.md`](./DESIGN.md) — the design spec (tokens, typography, components, motion)
- [`supabase/schema.sql`](./supabase/schema.sql) — database schema to run in Supabase

## License

Personal project — no license yet.
