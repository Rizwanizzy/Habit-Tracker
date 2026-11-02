/** Emoji support for habits (DESIGN.md §6): a habit can carry one emoji that is
 *  painted inside its check ring, so a tile stays identifiable when the name
 *  truncates on narrow screens. Pure helpers only — no React, no Supabase. */

/** Longest emoji we store, in code points. The picker can produce ZWJ and
 *  skin-tone sequences (a family is 7 code points, the longest "kiss" combos
 *  reach ~14), so 24 leaves headroom while keeping the check ring readable. */
export const EMOJI_MAX_CODE_POINTS = 24

/** Grapheme splitter (Intl.Segmenter, ES2022). Undefined in ancient engines;
 *  `normalizeEmoji` then falls back to plain code points. */
const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

/** The first user-perceived character, so a ZWJ sequence or a skin-tone
 *  modifier is never cut in half (e.g. 👨‍👩‍👧‍👦 or 👋🏽). */
function firstGrapheme(value: string): string {
  if (segmenter) {
    for (const { segment } of segmenter.segment(value)) return segment
  }
  return Array.from(value)[0] ?? ''
}

/** Trim an emoji field for storage: blank (or missing) becomes null; a longer
 *  string keeps its first grapheme only, capped at `EMOJI_MAX_CODE_POINTS`
 *  code points so a pathological combining sequence still fits the DB check. */
export function normalizeEmoji(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return Array.from(firstGrapheme(trimmed))
    .slice(0, EMOJI_MAX_CODE_POINTS)
    .join('')
}
