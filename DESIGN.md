# Design Spec: "Aurora Glass" habit tracker

Futuristic, calm, high-contrast. Bento-grid layout, glass cards, soft glow. Dark theme is the default. Light theme follows the pastel look: white cards, big radii, soft tinted tiles. Each habit's own color is the only strong color on screen; everything else is neutral.

## 1. Color tokens
| Token | Dark | Light |
|---|---|---|
| bg-base | #070A12 | #E6EEF8 |
| bg-aurora | radial-gradient(60% 50% at 12% 0%, rgba(99,102,241,.28), transparent), radial-gradient(50% 40% at 92% 8%, rgba(34,211,238,.20), transparent), radial-gradient(50% 50% at 50% 100%, rgba(236,72,153,.14), transparent) | radial-gradient(55% 45% at 8% 0%, rgba(125,211,252,.75), transparent 70%), radial-gradient(45% 40% at 95% 6%, rgba(196,181,253,.65), transparent 70%), radial-gradient(50% 45% at 88% 100%, rgba(253,186,160,.55), transparent 70%), radial-gradient(45% 45% at 10% 95%, rgba(167,243,208,.55), transparent 70%) |
| surface (glass) | rgba(255,255,255,.05) | linear-gradient(145deg, rgba(255,255,255,.62), rgba(255,255,255,.34)) |
| surface-2 | rgba(255,255,255,.08) | rgba(255,255,255,.40) rows/chrome (skeleton keeps flat #F1F4F6) |
| border | rgba(255,255,255,.10) | hairlines rgba(15,23,42,.08) · glass rims rgba(255,255,255,.75) |
| text-primary | #F4F6FB | #0F172A |
| text-secondary | #A3ACC2 | #475569 |
| text-muted | #6B7490 | #64748B |
| accent | #7C83FF | #4F46E5 |
| accent-gradient | linear-gradient(135deg,#7C83FF,#22D3EE) | linear-gradient(135deg,#4F46E5,#0EA5E9) |
| success | #34D399 | #16A34A |
| danger | #FB7185 | #E11D48 |
| chart-grid | rgba(255,255,255,.06) | rgba(15,23,42,.06) |
| chart-axis | #6B7490 | #64748B |

Glass recipe (dark): background surface, 1px border, backdrop-filter: blur(20px) saturate(140%), inset 0 1px 0 rgba(255,255,255,.08), shadow 0 24px 60px -24px rgba(0,0,0,.65).

### Light theme glass ("liquid glass" pass — light only, dark theme untouched)
- Background: #E6EEF8 under four pastel radial glows (sky, lavender, peach, mint), plus two fixed ~420px blurred orbs behind the shell (lavender top-right, sky blue bottom-left; blur 80px, opacity .5, below all content; 24s ease-in-out alternate drift, static under prefers-reduced-motion) so the glass has color to refract.
- Glass surfaces (shell, cards, tiles, dialogs, popovers): fill linear-gradient(145deg, rgba(255,255,255,.62), rgba(255,255,255,.34)), backdrop-filter blur(24px) saturate(180%), border 1px rgba(255,255,255,.75), box-shadow inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(99,102,241,.06), 0 24px 60px -24px rgba(79,70,229,.28), 0 2px 6px rgba(15,23,42,.04). Without backdrop-filter support: flat rgba(255,255,255,.92).
- Shell: 1px gradient border (white → rgba(125,211,252,.6) → rgba(196,181,253,.6), mask/clip technique) plus outer shadow 0 40px 100px -30px rgba(79,70,229,.30).
- Habit tiles on Today: fill linear-gradient(145deg, color-mix(habit 20%, white), color-mix(habit 7%, white)), border color-mix(habit 35%, white), colored shadow 0 16px 36px -18px habit 55%; readableColor still guards every habit-colored foreground.
- Inner rows / chrome: fill rgba(255,255,255,.40) with a rgba(255,255,255,.6) rim — never the flat gray fill. Controls (inputs, range switch, toggle track, chips): fill rgba(255,255,255,.55), white border, inset top highlight, accent focus ring with soft glow. Accent glow (active nav, primary buttons): 0 10px 28px -8px rgba(79,70,229,.55).
- Text on glass: headings #0F172A, secondary #475569, muted #64748B — all ≥ 4.5:1; chart axis labels use #64748B. Layout, sizes, animation and behavior are identical to dark.

## 2. Habit color rules (important)
- Habit color is used for: check ring/fill, progress bars, chart lines, heatmap cells, dots, tile tint, glow.
- Habit color is NEVER used for body text on a surface. Names stay text-primary.
- `readableColor(hex, theme)` in src/lib/color.ts: if contrast against the surface is below 3:1, raise lightness (dark theme) or lower it (light theme) until it passes. Use this for every foreground use of a habit color, so very dark or very light custom colors still show up.
- Tints: `color-mix(in srgb, <color> 22%, transparent)` for tile backgrounds, 35% for borders, 55% for glows.

## 3. Typography
- Headings and big numbers: "Space Grotesk" (Google Font). Body and UI: "DM Sans".
- Greeting/page title 32/40, weight 700. Hero numeral 56/56, weight 700, tabular-nums. Section title 18/24, 600. Habit name 17/24, 600. Body 15/22, 400. Caption 12/16, uppercase, tracking .08em, text-muted.

## 4. Shape, spacing, depth
- Radius: app shell 32px, cards 28px, tiles 24px, inputs 16px, buttons/chips/pills fully round.
- 4px spacing scale. Card padding 20px mobile, 24px desktop. Grid gap 16px mobile, 20px desktop. Page padding 16px mobile, 32px desktop. Max content width 1280px.
- Never use flat black cards with only a border. Every card has glass + soft shadow.

## 5. Layout shell
- Desktop (>=1024px): floating rounded shell inset 16px from the viewport edges over the aurora background. Slim 72px left rail with:
  - Top: logo mark (48px) in a glass tile; wordmark "Habit Tracker" present but visually hidden on the narrow rail.
  - Middle: Today, Overview, Settings as circular 48px icon buttons. Active: accent-gradient fill with glow. Inactive: surface-2 circle.
  - Bottom: Profile — the user's 48px avatar circle (icon fallback), active state with an accent-gradient ring when on /profile. No theme toggle in the rail; the theme toggle is a compact sun/moon icon button on the Today header.
- Mobile: no rail. Floating bottom dock, glass pill, 64px high, 16px from bottom and sides, 3 icon buttons (Today, Overview, Settings), respects safe-area inset. Content gets bottom padding so the dock never covers it. Profile is reached via the avatar in the Today header; Settings has a "View profile" link.
- Header on every page: greeting block (avatar, time-of-day greeting, "Hi, <name>", date) on the left, primary action pill on the right.

## 6. Components
- **Primary button:** 48px, accent-gradient, white text, glow shadow (0 10px 30px -8px accent at 60%). Hover: brightness 1.08 and translateY(-1px).
- **Secondary button:** glass pill, border, same height.
- **Habit tile (Today):** min-height 132px, background linear-gradient(145deg, habit 22%, habit 6%), border habit 35%. Top-left 44px circular check button: pending = 2px habit-color ring; done = filled habit color, white check, glow. Habit name below (plain text, not a link), then streak chip (flame icon + number) on the right. Numeric habits show a 6px rounded progress bar in the habit color plus "12 / 30 min" (value / target unit, never repeat the number). Edit icon appears on hover and is always visible on mobile. Hover: lift 2px, border brighter. **The whole tile is a stretched link to the habit's detail/overview page** (absolute-inset overlay, sr-only label); exactly three controls paint above it and keep their own behavior: the check button (toggle), the pencil (edit page) and the numeric value button/editor (log value). In reorder (jiggle) mode the overlay link is inert. **Dense columns (5-up ≥1280px):** the grid item is a CSS container; below a ~232px column the tile auto-compacts (min-height 104px, 14px padding, 36px check ring, smaller name/streak/value type) and invisible `::after` pads keep every control's effective tap target at ≥44px — full density applies on 1-up mobile columns.
- **Progress rings (hero):** concentric SVG rings driven by `src/lib/rings.ts` — ring order follows habit order from the outside in, exactly as `layoutRings` returns it: up to 7 habits each get a full ring of their own color (outermost = first); with more than 7, the first habits share the outer rings (equal arcs, up to 4 per ring: 50%/33%/25%…) and the remaining habits get full inner rings, capped at 28 shown habits. Each slice carries a 12%-opacity track arc and a progress arc (boolean = whole arc when done; numeric fills value/target clockwise from the slice start), 6px rule gaps with round caps. Geometry comes from `ringGeometry`, which packs the rings edge to edge between a ≥96px free center and the rim and centers them in the band: strokes are ~12px for 1–5 rings and thin to ~8.5px at 7, while the center hole shrinks as habits (rings) are added — from ~156px at one ring down to its 96px minimum — so there is never a large vacant middle. Center text counts ALL active habits ("3 / 12 done today"); the numeral scales down for big counts and the caption is hidden when the center gets tight. Hovering or tapping an arc shows a small glass tooltip (habit-color dot + name + "done"/"3 of 5 min"); targeting is a nearest-arc polar picker with a ≥24px tolerance — taps never toggle. Per-arc `aria-label`s plus a `role="img"` summary on the SVG.
- **Stat tile:** glass, caption label on top, big numeral, small delta chip with arrow (success or danger).
- **Chips (habit toggles):** 36px pill, small dot in habit color. Selected: habit 20% fill and habit 40% border. Unselected: 50% opacity.
- **Range switch:** segmented control with a sliding accent pill behind the active option, 40px high, equal-width segments, white-space nowrap. Under 400px uses short labels ("30d", "90d", "1y").
- **Color picker:** 10 preset round swatches (32px) with a ring on the selected one, plus a "custom" swatch that opens the native color input.
- **Inputs:** 52px, surface-2, 16px radius, 1px border, accent focus ring with glow.

## 7. Charts
- Line chart: monotone smooth curves, 2.5px stroke in the habit color, gradient area fill (habit 30% to 0%), soft glow via drop-shadow(0 0 8px habit 50%). Horizontal grid only, dashed, chart-grid color. No vertical grid, no axis lines. Axis labels 12px chart-axis.
- Active point: 8px dot with a 3px white ring, as in the reference. Tooltip: glass card, 16px radius, colored dot, habit name, value.
- Bars: 10px wide, fully rounded tops, 6px gap, habit color; today's bar glows.
- Heatmap: 14px cells, 4px radius, 4px gap; levels at habit 12%, 35%, 65%, 100%; the top level has a small glow. Month labels above, weekday labels left; month labels are thinned (`sparseMonthLabels`) — a month that starts within ~3 columns of the previous label is dropped and the roomier month keeps its name (no DEC/JAN collisions).
- Completion card (Today): **single-color intensity ramp** — the user picks ONE color for the whole card (palette popover with the standard color presets + native picker), and every day cell/bar is filled with that color via `color-mix(... N%, transparent)` where N follows the day's completion share (0 = neutral track, then 20…100%). It anchors to **real today** (not the backfill date pill), is non-interactive, and the chosen view + color persist in localStorage (`completion-view` / `completion-color`, default `#6366F1`).
- Charts always have an empty state (soft illustration-free message plus "Check in a habit to see your score").

## 8. Page layouts
- **Today (bento):** desktop 12-column grid. Row 1: Hero card (rings + "3/4 done" + motivational line + overall streak, 5 cols), Completion card (7 cols; always the same height as the hero card — week bars flex into the leftover room, month/year views shrink to fit **inside that same height**, they never grow the card). Header row: "This week/This month/This year" title + "% done per day" caption, a **Week | Month | Year segmented pill** and a palette button opening the color picker popover. Views: week = 7 rounded bar pills (height = share, single-color intensity fill, today glows); month = calendar grid of the current month (7 columns Sun–Sat ≤420px; weekday letters on top; each row shares the leftover body height so cells stay short rectangles, day number per cell, cells filled by intensity, blanks for lead/future); year = GitHub-style heatmap over a **rolling 10-month window ending at the current month** (columns flex `1fr` to the card width — **no horizontal scrollbar**; 10px rows, month labels on top, Sun–Sat rows with Mon/Wed/Fri labels) + a "Less → More" intensity legend under the month/year views. Row 2: habit tiles in a responsive grid (1 mobile, 2 tablet, 3 desktop, **5 wide ≥1280px** — roomier tiles, compacting below a ~232px column; 48→12px grid gap at 5-up). Header: compact circular theme icon button (52px round glass circle matching the date pill's height — sun in dark / moon in light, rotate + cross-fade swap, left of) the date pill with prev/next arrows and a calendar button.
- **Today reorder (jiggle) mode:** a 350ms long-press (8px tolerance, mouse + touch sensors; keyboard drags supported) on a tile lifts it into reorder mode and enters the mode via `onDragStart`. All tiles wiggle ±1.2° at 140ms ease-in-out infinite alternate, desynced by negative per-tile delays; inside the mode drags start after a 4px nudge instead of the long-press, the window auto-scrolls near the viewport edges (threshold y 0.2, acceleration 10), and touch scrolling is locked on the tiles while dragging. The dragged tile is a DragOverlay copy portalled to `document.body` (the shell carries `backdrop-filter`, which would otherwise trap the fixed overlay inside its containing block) at 1.04 scale with a stronger habit-colored glow while its source slot dims, sized to the source tile's measured rect, `pointer-events: none`, above the dock and toasts. The sortable attributes/listeners live on the tile's wrapper `<li>` at all times (`aria-roledescription="sortable"` is always in the DOM), so plain taps still reach the check-in/edit/link controls outside the mode and a swallow window (~150ms, set on drop) eats the trailing click after a drag. The header "Add habit" pill becomes "Done" (accent gradient) with a "Drag to reorder" caption; Escape or Done exits. Check-in circles, edit buttons and tile links are disabled and dimmed; native selection/long-press chrome is suppressed on tiles (`touch-action: manipulation` outside the mode, `none` inside). A drop saves the new order via `reorderHabits` with an "Order saved" toast (error toast if it rolls back).
- **Overview:** header with range switch. Row 1: three stat tiles (average score, best habit, needs attention) — Best habit and Needs attention are stretched links that drill into those habits' detail pages (habit name underlines on hover). Row 2: large chart card with the chip row inside it. No per-habit card list (removed — duplicated the Today-tile links; drill-in goes through the stat tiles).
- **Settings:** two-column on desktop. Habits card (manage rows with color dot, plain-text name and Archive/Restore — no per-row links, no edit pencil (editing lives on the Today tile) and no "Archived" chip; the Restore button alone marks an archived row — **2-up at ≥640px**, 1-up mobile; each row is a CSS container and compacts below ~272px) and Account card (signed-in email + "View profile" link; no button row). No Appearance card — the theme toggle is the icon button on the Today header.
- **Login:** centered glass card over the aurora background, logo mark above, gradient primary button.

## 9. Motion
- Easing cubic-bezier(.2,.8,.2,1). Durations: hover 160ms, page content 300ms.
- Page load: cards fade up 12px with 40ms stagger.
- Check-in: ring-pop (scale 1 to 1.15 to 1 in 280ms) plus a short burst of 6 small dots in the habit color; the hero ring arcs morph to their new fill (stroke-dasharray) in 400ms; big numbers count up.
- Rings and chart lines draw in on first render (900ms).
- Reorder: other tiles slide to make room at 200ms (dnd-kit default easing); the hero rings animate radius, slice position (rotation) and fill in 400ms.
- Respect prefers-reduced-motion: disable bursts and draw-ins; in reorder mode the wiggle becomes a static dashed outline and drags still work.

## 10. Do and don't
- Do keep neutral surfaces and let the habit colors carry the color.
- Do keep tap targets at least 44px.
- Don't use habit colors for text, uppercase habit names, or flat black card backgrounds.
- Don't add new dependencies except an icon set already in use. Animations are CSS and SVG only.
- Don't leave a page as one narrow centered column on desktop; use the grid.

## 11. Profile page
Layout from the reference, in the Aurora Glass theme (same tokens, glass cards, radii, fonts, and motion as the rest of the app).
- Header row: breadcrumb "My Account / Profile" (caption style, "Profile" in text-primary with a small user-circle icon) on the left. No action pill on the right.
- Banner: full-width background layer (no card border, no glass-card, no rounded corners), 160px high on desktop and 120px on mobile, with a subtle square-grid pattern (1px lines at chart-grid color, 56px cells, a few cells filled at 4% white). A radial mask-image fades the grid out toward the bottom and the sides so it blends into the page background. Dark theme keeps the soft aurora tint; light theme uses very faint grid lines.
- Avatar: 120px circle (96px on mobile) sitting inside the grid area, starting about 24px below the top of the grid block, 4px ring in bg-base, soft glow in the accent color. Fallback when there is no photo: initials on accent-gradient. A 36px circular camera button sits at its bottom-right corner and opens a keyboard-accessible popover menu with "Change photo" and "Remove photo" (the second only when a photo exists; a confirmation step precedes removal). The popover closes on outside click and Escape.
- Below the avatar: full name in 32/40 Space Grotesk 700, with a verified badge (22px on desktop, 18px on mobile) after it when the email is confirmed; the email below in text-secondary.
  - **Verified badge:** blue scalloped seal (r(theta) = 10 + 1.1 * cos(8 * theta), 120 points) with a white checkmark, rendered as an inline SVG via the `VerifiedBadge` component (`src/components/VerifiedBadge.tsx`). The seal uses a linearGradient from #4DA6FF to #1D7CF2, has a drop-shadow glow, and carries `role="img"` with `aria-label="Verified"`. Name and badge sit in one inline-flex container with the name truncating on overflow.
- "Personal details" card: glass card, 28px radius. A header row (title 16px 600 plus the edit control on the right) separated by a 1px border, then rows: Full name, Date of birth, Gender, Nationality, Address (country + city or region), Phone number, Email. Each row is a two-column grid (label 35%, value 65%; stacked on mobile), label in text-secondary, value in text-primary, dashed 1px dividers between rows, 16px vertical padding. Empty values show "Not added" in text-muted.
- Edit mode: the rows turn into inputs (52px, surface-2) in place with no page change; Gender is a segmented control, Date of birth a date input, Phone a tel input. Save (primary, 48px) and Cancel (secondary) buttons appear in the card header and stay visible while scrolling. Email stays read-only with a small lock icon. The Edit control (36px, ghost/outline glass-pill style) is replaced by Save/Cancel in the same spot.
- Avatar upload: crop to a centered square, resize to 512px, convert to webp, then upload. Show a progress ring on the avatar while uploading; show an error toast if the file is over 2 MB or not an image. Remove photo is accessed via the camera button popover.
- States: skeleton shimmer while loading, inline error with Retry, success toast "Profile saved".
- Desktop: the card is max 720px wide and centered under the avatar block. Mobile: full width, single column.
- Navigation: Profile is accessed via the avatar in the Today header (navigates to /profile) and via the "View profile" link in Settings; not in the rail or mobile dock.

## 12. Brand and icons
- Logo source: `design-refs/habit-tracker-logo.png` (PNG master) or `public/logo.png` (served copy).
- Logo placement: sidebar header (logo mark + "Habit Tracker" wordmark, wordmark visually hidden on narrow rail), Login page above the card.
- Generated icons (run `npm run icons`, uses `@vite-pwa/assets-generator`):
  - `public/favicon.ico` (16/32/48)
  - `public/logo.png` (logo master, 192x192)
  - `public/icon-192.png` (192x192 PNG)
  - `public/icon-512.png` (512x512 PNG)
  - `public/icon-maskable-512.png` (512x512 maskable, logo at ~70% on solid #070A12)
  - `public/apple-touch-icon.png` (180x180, solid #070A12, no transparency)
- `index.html`: favicon links (SVG + ICO), apple-touch-icon, theme-color meta `#070A12`, title "Habit Tracker".
- `vite.config.ts` PWA manifest: name "Habit Tracker", short_name "Habits", theme_color/background_color `#070A12`, display standalone, start_url "/", icons 192/512/maskable-512.

## 13. Dialogs
All confirmation dialogs use the shared `ConfirmDialog` component (`src/components/ConfirmDialog.tsx`), rendered via `createPortal` into `document.body` so no parent with `backdrop-filter`, `transform`, `filter`, or `overflow` can break the blur.

- **Scrim:** full-screen layer behind the dialog. `rgba(4,6,14,0.55)` in dark, `rgba(15,23,42,0.28)` in light, plus `backdrop-filter: blur(10px) saturate(120%)`. Fades in over 160ms. Clicking the scrim cancels.
- **Dialog panel:** glass, not solid. Width `min(420px, calc(100vw - 32px))`, radius 28px, padding 24px.
  - Dark: background `linear-gradient(145deg, rgba(34,38,64,0.78), rgba(14,18,36,0.72))`; border `1px solid rgba(255,255,255,0.14)`; `backdrop-filter: blur(28px) saturate(150%)`; shadow `inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 80px -20px rgba(0,0,0,0.7), 0 0 60px -20px color-mix(in srgb, var(--accent) 35%, transparent)`.
  - Light: background `linear-gradient(145deg, rgba(255,255,255,0.88), rgba(241,244,246,0.80))`; border `1px solid rgba(15,23,42,0.10)`; same blur; shadow `0 24px 60px -24px rgba(15,23,42,0.30)`.
  - `@supports not (backdrop-filter: blur(1px))` raises panel background opacity to 0.94 so content never shows through in browsers without blur.
  - A thin 2px gradient line (accent-gradient, 40% opacity) along the top edge; hidden for the danger variant, which uses a soft danger-colored glow instead.
- **Content:** title in heading font at 22px; description in sentence case at 15px, `text-secondary` (not uppercase, no letter-spacing). Buttons right-aligned in a row: Cancel as secondary ghost pill, confirm as danger pill (soft danger tint `rgba(251,113,133,0.14)`, danger border and text, stronger hover fill). Both 44px high. Under 400px, buttons stack full width, confirm on top.
- **Behavior & accessibility:** `role="alertdialog"` with `aria-labelledby` and `aria-describedby`; focus moves to Cancel on open; focus trap inside; Escape cancels; focus returns to opener on close; body scroll locked while open. Entry animation: scale 0.96 to 1 plus fade over 200ms with cubic-bezier(0.2, 0.8, 0.2, 1); disabled under `prefers-reduced-motion`.
- Used for: sign-out confirmation on the Profile page, remove-photo confirmation in the Profile banner.