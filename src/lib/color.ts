/**
 * Pure color helpers for the Aurora Glass design (DESIGN.md §2).
 * No React or Supabase imports — keep it testable in isolation.
 */

export type ThemeName = 'dark' | 'light'

/** Effective glass surface behind habit-colored elements (surface over bg-base). */
export function surfaceColor(theme: ThemeName): string {
  return theme === 'dark' ? '#13161e' : '#f8fafc'
}

/** Habit-color tint for tile backgrounds (22%), borders (35%) and glows (55%). */
export function tint(hex: string, percent: number): string {
  return `color-mix(in srgb, ${normalize(hex)} ${Math.round(percent)}%, transparent)`
}

/** WCAG contrast ratio between two hex colors. */
export function contrast(hexA: string, hexB: string): number {
  const la = luminance(hexToRgb(normalize(hexA)))
  const lb = luminance(hexToRgb(normalize(hexB)))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const MIN_RATIO = 3

/**
 * Return `hex` adjusted so it reads against the theme's surface with at least
 * 3:1 contrast. Dark theme raises lightness; light theme lowers it. Colors that
 * already pass come back unchanged, so very dark or very light custom habit
 * colors still show up on rings, bars, dots and heatmaps.
 */
export function readableColor(hex: string, theme: ThemeName, minRatio: number = MIN_RATIO): string {
  const base = normalize(hex)
  const surface = surfaceColor(theme)
  if (contrast(base, surface) >= minRatio) return base

  const [r, g, b] = hexToRgb(base)
  const [h, s, l] = rgbToHsl(r, g, b)
  const step = theme === 'dark' ? 0.04 : -0.04
  let lightness = l
  for (let i = 0; i < 50; i++) {
    lightness = Math.min(0.99, Math.max(0.01, lightness + step))
    const candidate = rgbToHex(...hslToRgb(h, s, lightness))
    if (contrast(candidate, surface) >= minRatio) return candidate
  }
  // Clamped at the far end and still below the ratio — fall back to the theme
  // secondary text color, which always reads on the surface.
  return theme === 'dark' ? '#a3acc2' : '#5b6472'
}

/* ------------------------------------------------------------------ */
/* Hex plumbing                                                       */
/* ------------------------------------------------------------------ */

function normalize(hex: string): string {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? Array.from(h, (c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex color: ${hex}`)
  return `#${full.toLowerCase()}`
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  // Round-trip through clamped ints so mixing never produces out-of-range bytes.
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function luminance([r, g, b]: [number, number, number]): number {
  const [r255, g255, b255] = [r / 255, g / 255, b / 255]
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(r255) + 0.7152 * linear(g255) + 0.0722 * linear(b255)
}

/* HSL round-trip, for the lightness walk in readableColor. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const range = max - min
  if (range === 0) return [0, 0, l]
  const s = l > 0.5 ? range / (2 - max - min) : range / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / range + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / range + 2) / 6
  else h = ((rn - gn) / range + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const conv = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [conv(h + 1 / 3) * 255, conv(h) * 255, conv(h - 1 / 3) * 255]
}
