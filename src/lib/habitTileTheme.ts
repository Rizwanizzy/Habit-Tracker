import type { CSSProperties } from 'react'
import { tint, type ThemeName } from './color'

export type HabitTileVars = Record<
  '--tile-bg' | '--tile-border' | '--tile-border-hover' | '--tile-glow',
  string
>

const LIGHT_THEMES = new Set(['light', 'sepia', 'solarized-light'])

/** Today-tile color treatment, shared with the Settings habit cards.
 *  `muted` is the archived variant: same habit color, softened tints/border. */
export function habitTileVars(
  color: string,
  theme: ThemeName,
  muted = false,
): HabitTileVars {
  if (LIGHT_THEMES.has(theme)) {
    const bgTop = `color-mix(in srgb, ${color} ${muted ? 10 : 20}%, white)`
    const bgBottom = `color-mix(in srgb, ${color} ${muted ? 3 : 7}%, white)`
    const border = `color-mix(in srgb, ${color} ${muted ? 20 : 35}%, white)`
    return {
      '--tile-bg': `linear-gradient(145deg, ${bgTop}, ${bgBottom})`,
      '--tile-border': border,
      '--tile-border-hover': `color-mix(in srgb, ${color} ${muted ? 45 : 70}%, white)`,
      '--tile-glow': `color-mix(in srgb, ${color} ${muted ? 35 : 55}%, transparent)`,
    }
  }

  return {
    '--tile-bg': `linear-gradient(145deg, ${tint(color, muted ? 12 : 22)}, ${tint(color, muted ? 3 : 6)})`,
    '--tile-border': tint(color, muted ? 20 : 35),
    '--tile-border-hover': tint(color, muted ? 45 : 70),
    '--tile-glow': `color-mix(in srgb, ${color} ${muted ? 35 : 55}%, transparent)`,
  }
}

/** Direct style form for cards that do not use the `.habit-tile` CSS hooks. */
export function habitTileSurfaceStyle(
  color: string,
  theme: ThemeName,
  muted = false,
): CSSProperties {
  const vars = habitTileVars(color, theme, muted)
  return {
    backgroundImage: vars['--tile-bg'],
    borderColor: vars['--tile-border'],
  } as CSSProperties
}
