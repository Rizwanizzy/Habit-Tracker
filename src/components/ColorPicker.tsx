import { useRef } from 'react'

const PRESETS = [
  '#3B82F6',
  '#22D3EE',
  '#22C55E',
  '#84CC16',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#6366F1',
  '#0F172A',
]

interface Props {
  color: string
  onChange: (hex: string) => void
  /** Optional extra callback fired ONLY by the preset swatches — the mobile
   *  popover uses it to close shortly after a preset pick while the custom
   *  picker and hex field keep it open. Untouched when omitted. */
  onPreset?: (hex: string) => void
}

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)

/** Color picker (DESIGN.md §6): 10 preset 32px round swatches with a ring on
 *  the selected one, plus a rainbow "custom" swatch that opens the native
 *  color input for any hex. */
export function ColorPicker({ color, onChange, onPreset }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isPreset = PRESETS.some((hex) => hex.toLowerCase() === color.toLowerCase())
  const ringFor = (selected: boolean, hex: string) =>
    selected
      ? `0 0 0 2.5px var(--surface), 0 0 0 5px ${hex}`
      : undefined

  return (
    <div>
      <p className="text-caption text-fg-muted">Color</p>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {PRESETS.map((hex) => {
          const selected = hex.toLowerCase() === color.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              aria-label={`Use color ${hex}`}
              aria-pressed={selected}
              onClick={() => {
                onChange(hex)
                onPreset?.(hex)
              }}
              className="relative size-8 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 after:absolute after:-inset-1.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              style={{ backgroundColor: hex, boxShadow: ringFor(selected, hex) }}
            />
          )
        })}
        {/* Custom swatch: rainbow wheel; shows a selection ring + the current
            color dot when the chosen color is not a preset. */}
        <button
          type="button"
          aria-label="Pick a custom color"
          aria-pressed={!isPreset && isHex(color)}
          onClick={() => inputRef.current?.click()}
          className="relative size-8 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 after:absolute after:-inset-1.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          style={{
            background:
              'conic-gradient(from 45deg, #ef4444, #f59e0b, #84cc16, #22d3ee, #6366f1, #ec4899, #ef4444)',
            boxShadow: ringFor(!isPreset && isHex(color), color),
          }}
        >
          {!isPreset && isHex(color) && (
            <span
              className="absolute inset-0 grid place-items-center"
              aria-hidden="true"
            >
              <span className="size-3 rounded-full border border-white/60" style={{ backgroundColor: color }} />
            </span>
          )}
        </button>
      </div>

      {/* Hidden native input opened by the custom swatch. */}
      <input
        ref={inputRef}
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#3b82f6'}
        onChange={(e) => onChange(e.target.value)}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute size-0 opacity-0"
      />

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={color}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (isHex(v)) onChange(v)
          }}
          aria-label="Custom hex color"
          className="h-11 w-32 rounded-input border border-border bg-surface-raised px-3 text-body tabular-nums text-fg transition-colors duration-150 focus:border-accent focus:outline-none"
          placeholder="#3B82F6"
        />
        <span className="text-caption text-fg-muted">Hex</span>
      </div>
    </div>
  )
}
