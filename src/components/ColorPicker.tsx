const PRESETS = ['#3B82F6', '#22D3EE', '#22C55E', '#84CC16', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1', '#0F172A']

interface Props {
  color: string
  onChange: (hex: string) => void
}

/** Preset swatches + native color input for any custom hex. */
export function ColorPicker({ color, onChange }: Props) {
  return (
    <div>
      <label className="block font-medium text-fg-secondary text-body">Color</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESETS.map((hex) => {
          const selected = hex.toLowerCase() === color.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              aria-label={`Use color ${hex}`}
              aria-pressed={selected}
              onClick={() => onChange(hex)}
              className="size-9 rounded-full transition-transform duration-150 active:scale-95"
              style={{
                backgroundColor: hex,
                boxShadow: selected
                  ? `0 0 0 2px var(--surface-raised), 0 0 0 4px ${hex}`
                  : undefined,
              }}
            />
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick a custom color"
          className="h-11 w-14 cursor-pointer rounded-button border border-border bg-surface p-1"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) onChange(v)
          }}
          aria-label="Custom hex color"
          className="h-11 w-28 rounded-button border border-border bg-surface px-3 text-caption text-fg"
          placeholder="#3B82F6"
        />
      </div>
    </div>
  )
}