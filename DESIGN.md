1. Overall feel

Calm, focused, and intentionally low-density. The interface uses dark surfaces as the default mood, with deep charcoal backgrounds and generous whitespace so progress stands out without visual clutter. Habit colors are the only vivid accents; every neutral element stays muted so the user's chosen habit color carries meaning. Designed mobile-first, the same components scale cleanly to desktop with consistent proportions and tap targets.

2. Color tokens

Token	Light value	Dark value
background	#ffffff	#0f0f13 (estimated)
surface	#f8fafc	#16161d (estimated)
surface-raised	#ffffff	#1f1f26 (estimated)
border	#e2e8f0	#33333a (estimated)
text-primary	#0f172a	#e4e4e7 (estimated)
text-secondary	#475569	#a8a8b2 (estimated)
text-muted	#94a3b8	#71717a (estimated)
accent	#3b82f6 (estimated)	#6366f1 (estimated)
success	#22c55e	#22c55e
danger	#ef4444	#ef4444
chart-grid	#e2e8f0	#33333a
chart-axis	#94a3b8	#71717a

3. Typography

Font family: Inter (free Google Font), with system-ui as fallback. All text uses clean sans-serif letterforms.
- Page title: 32px, weight 700, line-height 1.2
- Section title: 22px, weight 600, line-height 1.3
- Habit name: 17px, weight 500, line-height 1.4
- Body: 15px, weight 400, line-height 1.5
- Caption: 12px, weight 400, line-height 1.4
- Big stat number: 34px, weight 700, line-height 1.1

4. Spacing, radius, elevation

Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Page padding mobile: 16px on each side.
- Page padding desktop: 24px on each side, with content centered in a max-width container of about 800px.
- Card radius: 16px.
- Button radius: 12px.
- Pill / chip radius: full (9999px).
- Elevation: primarily expressed through a 1px border in the border token rather than heavy shadows. If a shadow is used on raised cards, keep it soft (estimated: 0 1px 3px rgba(0,0,0,0.08) in light mode, 0 1px 3px rgba(0,0,0,0.4) in dark mode).

5. Components

*Habit row on the Today screen*
A full-width surface-raised card, 16px radius, with 16px internal padding. On the left is a circular checkbox (about 24px diameter). When completed, the ring fills with the habit's color and shows a white check; when pending, it is a thin ring in border color. Next to it, the habit name sits at 17px, weight 500, in the habit's color. On the right is a streak badge: a pill-shaped badge with surface background, a small colored dot in the habit's color, and the streak number at 12px, weight 600, in text-secondary. Hover state subtly lightens the card background; pressed state scales to 0.98.

*Primary and secondary buttons*
Primary button: filled with the habit color or accent token, white text at 15px weight 600, 12px radius, 48px height. Hover reduces opacity slightly; pressed scales to 0.98. Secondary button: transparent background, 1px border in border color, text in text-primary at 15px weight 500, 12px radius, 48px height. Hover fills with surface-raised color.

*Cards and stat tiles*
Surface background, 16px radius, 1px border in border color, 16–20px padding. Stat tiles show a large number at 34px weight 700 in text-primary, with a small label beneath at 12px weight 400 in text-muted.

*Color picker*
A horizontal row of circular swatches, about 32px diameter, spaced 8px apart. The active swatch shows a 2px white outer ring with a 2px inner ring in the selected habit color. The custom option is a rectangular input about 40px wide showing the current hex value, paired with a native color input control.

*Bottom or top navigation*
Mobile: fixed bottom bar, surface background, height about 72px, with a 1px border at the top. Contains three to five icon buttons (icons about 24px) with labels beneath at 10px weight 500. Active item tints with the habit color or accent; inactive items use text-muted. Desktop: a top header row with the same styling laid out horizontally instead of a bottom bar.

6. Charts

*Score-over-time line chart*
Line width about 2.5px (estimated), drawn with a smooth monotone curve rather than sharp angles. Fill under the line at about 8–10% opacity in the habit's color. Horizontal gridlines only, 1px in chart-grid color. Axis labels at 11px in chart-axis color. Tooltip: a surface-raised card with 10px radius, 8px vertical and 12px horizontal padding, showing a colored dot matching the habit, the date, and the value.

*Bar charts (weekly / monthly)*
Bars about 14px wide (estimated), with 6px corner radius on the top corners, and 10px gaps between bars. Bars are filled in the habit's color. Value labels sit above each bar at 11px in text-secondary.

*Calendar heatmap*
Cells are squares about 32px (estimated), with a 5px gap and 6px radius. A completed day shows the full habit color. A missed day shows surface-raised (dark gray on dark mode, light gray on light mode). Partial completion is shown by mixing the habit color with transparent at about 40% intensity. Month labels appear above their column group at 10px in text-muted. Weekday labels appear on the right edge at 10px in text-muted.

*Legend and habit toggle chips*
Pill-shaped chips, height 28px, padding 0 12px, with a 1.5px border in the habit's color. Text at 12px weight 500 in the habit's color. The active/selected chip is filled with the habit's color and shows white text.

7. Layout

*Today*
Mobile: sticky header (about 56px) with the page title, followed by stat tiles in a two-column grid, then a scrollable list of habit rows, and the fixed bottom navigation at the very bottom. Desktop: centered container with a top header row instead of bottom navigation; the habit list occupies the full content width.

*Overview*
Mobile: stat tiles in a scrollable horizontal row or two-column grid, then the score line chart full width, then the calendar heatmap full width. Desktop: stat tiles and charts arranged side by side with wider chart areas and more whitespace between sections.

*Habit detail*
Mobile: header with a back arrow on the left, the habit name centered, and an edit action on the right. Below, stacked vertically: overview stat tiles, score line chart, calendar heatmap, and a best-streaks section. Desktop: same stacked order but in a centered max-width column (about 700px), with more horizontal breathing room around charts.

8. Motion and feedback

Check-in animation: when a habit is toggled, the checkbox scales down to 0.8 over 100ms, then expands back to 1.0 while the checkmark draws itself over 200ms, using an ease-out curve. Page transitions last about 220ms with ease-out. Hover states transition over 150ms. Optimistic updates appear immediately in the UI; if sync fails, the UI rolls back with a brief shake animation (about 400ms total) and shows a visible error message.

9. Do and don't

    1. Do read every habit color from the habit record; never hardcode a fixed color for a specific habit.
    2. Do keep neutral UI (borders, surfaces, text) consistent across light and dark modes using the token pairs above.
    3. Do express card elevation mainly with a 1px border; keep shadows soft and minimal if used at all.
    4. Do not apply more than one habit color to a single neutral element; each habit appears in exactly one user-chosen color.
    5. Do not use UTC date strings for display; always show local YYYY-MM-DD in the user's timezone.