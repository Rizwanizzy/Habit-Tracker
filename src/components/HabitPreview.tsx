import { tint } from '../lib/color'

interface Props {
  name: string
  emoji: string
  color: string
}

/** Live "how the tile will look on Today" preview, shared by the desktop
 *  color card and the phone layout of the Add/Edit habit page: a tile in
 *  the habit's own color gradient with the emoji in its ring (or a plain
 *  color dot when no emoji is chosen) and the (truncating) habit name. */
export function HabitPreview({ name, emoji, color }: Props) {
  return (
    <div
      className="rounded-tile p-4"
      style={{
        backgroundImage: `linear-gradient(145deg, ${tint(color, 22)}, ${tint(color, 6)})`,
        border: `1px solid ${tint(color, 35)}`,
      }}
    >
      <div className="flex items-center gap-2">
        {emoji ? (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full text-lg leading-none"
            style={{
              border: `2px solid ${color}`,
              backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            }}
          >
            {emoji}
          </span>
        ) : (
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span className="text-habit-name min-w-0 truncate text-fg">{name || 'Your habit'}</span>
      </div>
    </div>
  )
}
