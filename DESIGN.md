# Design Spec: "Aurora Glass" habit tracker

Futuristic, calm, high-contrast. Bento-grid layout, glass cards, soft glow. Dark theme is the default. Light theme follows the pastel look: white cards, big radii, soft tinted tiles. Each habit's own color is the only strong color on screen; everything else is neutral.

## 1. Color tokens
| Token | Dark | Light |
|---|---|---|
| bg-base | #070A12 | #DCE8EE |
| bg-aurora | radial-gradient(60% 50% at 12% 0%, rgba(99,102,241,.28), transparent), radial-gradient(50% 40% at 92% 8%, rgba(34,211,238,.20), transparent), radial-gradient(50% 50% at 50% 100%, rgba(236,72,153,.14), transparent) | radial-gradient(60% 50% at 10% 0%, rgba(125,211,252,.55), transparent), radial-gradient(50% 50% at 95% 100%, rgba(190,242,100,.35), transparent) |
| surface (glass) | rgba(255,255,255,.05) | rgba(255,255,255,.80) |
| surface-2 | rgba(255,255,255,.08) | #F1F4F6 |
| border | rgba(255,255,255,.10) | rgba(15,23,42,.08) |
| text-primary | #F4F6FB | #0F1217 |
| text-secondary | #A3ACC2 | #5B6472 |
| text-muted | #6B7490 | #98A1AF |
| accent | #7C83FF | #4F46E5 |
| accent-gradient | linear-gradient(135deg,#7C83FF,#22D3EE) | linear-gradient(135deg,#4F46E5,#0EA5E9) |
| success | #34D399 | #16A34A |
| danger | #FB7185 | #E11D48 |
| chart-grid | rgba(255,255,255,.06) | rgba(15,23,42,.06) |
| chart-axis | #6B7490 | #98A1AF |

Glass recipe (dark): background surface, 1px border, backdrop-filter: blur(20px) saturate(140%), inset 0 1px 0 rgba(255,255,255,.08), shadow 0 24px 60px -24px rgba(0,0,0,.65).
Glass recipe (light): same blur, shadow 0 20px 50px -24px rgba(15,23,42,.18).

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
- Desktop (>=1024px): floating rounded shell inset 16px from the viewport edges over the aurora background. Slim 72px left rail with circular 48px icon buttons (Today, Overview, Settings). Active button: accent-gradient fill with glow. Inactive: surface-2 circle. Theme toggle and sign-out as circle buttons at the bottom of the rail.
- Mobile: no rail. Floating bottom dock, glass pill, 64px high, 16px from bottom and sides, 3 icon buttons, respects safe-area inset. Content gets bottom padding so the dock never covers it.
- Header on every page: greeting or page title on the left, date caption beneath, primary action pill on the right.

## 6. Components
- **Primary button:** 48px, accent-gradient, white text, glow shadow (0 10px 30px -8px accent at 60%). Hover: brightness 1.08 and translateY(-1px).
- **Secondary button:** glass pill, border, same height.
- **Habit tile (Today):** min-height 132px, background linear-gradient(145deg, habit 22%, habit 6%), border habit 35%. Top-left 44px circular check button: pending = 2px habit-color ring; done = filled habit color, white check, glow. Habit name below, then streak chip (flame icon + number) on the right. Numeric habits show a 6px rounded progress bar in the habit color plus "12 / 30 min" (value / target unit, never repeat the number). Edit icon appears on hover and is always visible on mobile. Hover: lift 2px, border brighter.
- **Progress rings (hero):** concentric SVG rings, one per habit, each in its habit color, outermost = first habit. Stroke 10px, 6px gap, round caps, 12% opacity track. Center shows the big numeral "3/4" and caption "done today". Max 7 rings.
- **Stat tile:** glass, caption label on top, big numeral, small delta chip with arrow (success or danger).
- **Chips (habit toggles):** 36px pill, small dot in habit color. Selected: habit 20% fill and habit 40% border. Unselected: 50% opacity.
- **Range switch:** segmented control with a sliding accent pill behind the active option, 36px high.
- **Color picker:** 10 preset round swatches (32px) with a ring on the selected one, plus a "custom" swatch that opens the native color input.
- **Inputs:** 52px, surface-2, 16px radius, 1px border, accent focus ring with glow.

## 7. Charts
- Line chart: monotone smooth curves, 2.5px stroke in the habit color, gradient area fill (habit 30% to 0%), soft glow via drop-shadow(0 0 8px habit 50%). Horizontal grid only, dashed, chart-grid color. No vertical grid, no axis lines. Axis labels 12px chart-axis.
- Active point: 8px dot with a 3px white ring, as in the reference. Tooltip: glass card, 16px radius, colored dot, habit name, value.
- Bars: 10px wide, fully rounded tops, 6px gap, habit color; today's bar glows.
- Heatmap: 14px cells, 4px radius, 4px gap; levels at habit 12%, 35%, 65%, 100%; the top level has a small glow. Month labels above, weekday labels left.
- Charts always have an empty state (soft illustration-free message plus "Check in a habit to see your score").

## 8. Page layouts
- **Today (bento):** desktop 12-column grid. Row 1: Hero card (rings + "3/4 done" + motivational line + overall streak, 5 cols), Weekly completion card (7 smooth-curve/bar mini chart, 7 cols). Row 2: habit tiles in a responsive grid (3 columns desktop, 2 tablet, 1 mobile). Date navigation is a pill with prev/next arrows and a calendar button, placed in the header.
- **Overview:** header with range switch. Row 1: three stat tiles (average score, best habit, needs attention). Row 2: large chart card with the chip row inside it. Row 3: per-habit mini cards, each with a sparkline in its color.
- **Settings:** two-column on desktop. Appearance card (theme toggle with a sun/moon animation), Habits card (list with color dot, edit, archive), Account card. Sign-out is a subtle danger-outline button.
- **Login:** centered glass card over the aurora background, logo mark above, gradient primary button.

## 9. Motion
- Easing cubic-bezier(.2,.8,.2,1). Durations: hover 160ms, page content 300ms.
- Page load: cards fade up 12px with 40ms stagger.
- Check-in: ring-pop (scale 1 to 1.15 to 1 in 280ms) plus a short burst of 6 small dots in the habit color; the hero rings animate to their new value over 700ms; big numbers count up.
- Rings and chart lines draw in on first render (900ms).
- Respect prefers-reduced-motion: disable bursts and draw-ins.

## 10. Do and don't
- Do keep neutral surfaces and let the habit colors carry the color.
- Do keep tap targets at least 44px.
- Don't use habit colors for text, uppercase habit names, or flat black card backgrounds.
- Don't add new dependencies except an icon set already in use. Animations are CSS and SVG only.
- Don't leave a page as one narrow centered column on desktop; use the grid.