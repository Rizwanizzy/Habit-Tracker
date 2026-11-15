import { normalizeEmoji } from '../lib/emoji'
import { IconArchive, IconUnarchive, IconPencil } from './icons'
import type { Habit } from '../lib/score'
import { useNavigate } from 'react-router-dom'
import { habitTileSurfaceStyle } from '../lib/habitTileTheme'
import { useThemeName } from '../hooks/useThemeName'

/** Phone (below-lg) habit tile for the Settings "Habits" card: a compact
 *  two-line tile — the emoji circle (habit-color ring, or a plain color dot)
 *  with an archive/restore icon button beside it, then the name — replacing
 *  the desktop ManageRow there. It runs the exact same toggleArchive
 *  handler; no new behaviour. `lg:hidden` keeps it out of the desktop
 *  layout (the rows there are hidden below lg instead). */
export function ManageTileMobile({
  habit,
  busy,
  archived,
  onToggleArchive,
}: {
  habit: Habit
  busy: boolean
  archived: boolean
  onToggleArchive: (h: Habit) => void
}) {
  const navigate = useNavigate()
  const theme = useThemeName()
  const emoji = normalizeEmoji(habit.emoji)
  const color = habit.color ?? '#3B82F6'
  return (
    <li
      className={`flex min-h-[84px] min-w-0 flex-col justify-between gap-1.5 rounded-tile border border-border bg-surface-raised p-2.5 lg:hidden ${
        archived ? 'opacity-[.85]' : ''
      }`}
      style={habitTileSurfaceStyle(color, theme, archived)}
    >
      <div className="flex items-center justify-between gap-2">
        {emoji ? (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full text-base leading-none"
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
        <div className="flex items-center gap-1.5">
          {!archived && (
            <button
              type="button"
              onClick={() => navigate(`/habits/${habit.id}/edit`)}
              disabled={busy}
              aria-label={`Edit ${habit.name}`}
              className="glass-pill relative grid size-9 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-150 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60 after:absolute after:-inset-1 after:content-['']"
            >
              <IconPencil className="size-5" />
            </button>
          )}
          {archived && (
            <button
              type="button"
              disabled
              className="glass-pill relative grid size-9 shrink-0 place-items-center rounded-full text-fg-muted/50 cursor-not-allowed after:absolute after:-inset-1 after:content-['']"
              title="Unarchive to edit"
              aria-label={`Cannot edit ${habit.name} — unarchive first`}
            >
              <IconPencil className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleArchive(habit)}
            disabled={busy}
            aria-label={`${archived ? 'Restore' : 'Archive'} ${habit.name}`}
            title={archived ? 'Restore' : 'Archive'}
            className="glass-pill relative grid size-9 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-150 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60 after:absolute after:-inset-1 after:content-['']"
          >
            {archived ? <IconUnarchive className="size-5" /> : <IconArchive className="size-5" />}
          </button>
        </div>
      </div>
      <span className="line-clamp-2 min-w-0 break-words text-sm font-semibold leading-5 text-fg" title={habit.name}>
        {habit.name}
      </span>
    </li>
  )
}
