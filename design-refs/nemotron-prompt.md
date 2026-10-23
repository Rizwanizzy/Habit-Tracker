You are a senior product designer. I've attached screenshots of apps whose look I want to borrow for a personal habit tracker website. Study them and write a design specification in Markdown that a developer can implement without seeing the screenshots.

Rules:
- Be concrete: give hex colors, px or rem sizes, border radius, shadow values, font sizes and weights. If you must estimate a value from the image, add "(estimated)".
- Describe the visual style only. Do not write code and do not mention the app names.
- Habit colors are chosen by the user, one per habit, so do NOT assign fixed colors to habits. Describe the neutral UI around them.
- Design for a mobile-first website that also works well on desktop.

Output exactly these sections:

# Design Spec

## 1. Overall feel
Three to five sentences: mood, density, what makes it feel calm and focused.

## 2. Color tokens
A table of token name, light value, dark value (give both if visible; otherwise propose the matching pair). Tokens: background, surface, surface-raised, border, text-primary, text-secondary, text-muted, accent, success, danger, chart-grid, chart-axis.

## 3. Typography
Font family style (and a free Google Font that matches), plus sizes, weights and line heights for: page title, section title, habit name, body, caption, big stat number.

## 4. Spacing, radius, elevation
Spacing scale, page padding on mobile and desktop, card radius, button radius, shadow or border usage.

## 5. Components
For each, describe look and states (default, hover, pressed, completed):
- Habit row on the Today screen (checkbox style, name, streak badge)
- Primary and secondary buttons
- Cards and stat tiles
- Color picker (swatches and custom option)
- Bottom or top navigation

## 6. Charts
- Score-over-time line chart: line width, smoothing, fill under line, gridlines, axis labels, tooltip style
- Bar charts (weekly/monthly): bar width, corner radius, gaps
- Calendar heatmap: cell size, gap, radius, how intensity levels are shown, month and weekday labels
- Legend and habit toggle chips

## 7. Layout
Page structure for Today, Overview, and Habit detail on mobile and on desktop.

## 8. Motion and feedback
Check-in animation, transitions, durations and easing.

## 9. Do and don't
Five short rules that keep the look consistent.