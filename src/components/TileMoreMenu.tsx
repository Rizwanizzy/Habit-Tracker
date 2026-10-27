import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconMore } from './icons'

interface Props {
  habitId: string
  habitName: string
  /** "today" or a short date label for the "Skip <day>" item. */
  dayLabel: string
  skipped: boolean
  /** Reorder mode: the menu is disabled (and closed). */
  disabled: boolean
  /** Compact tiles hide the pencil (container query < 232px), so the menu
   *  carries the edit item instead. */
  showEditItem: boolean
  onSkipToggle: () => void
  /** Lets the tile lift itself above sibling contexts while open. */
  onOpenChange?: (open: boolean) => void
}

/** The habit tile's "more" popover (DESIGN.md §6, skip task): the same size
 *  and hover rules as the edit pencil, opening a small glass menu with
 *  "Skip <day>" / "Undo skip" (and "Edit habit" in compact mode). Outside
 *  click and Escape close it — the CompletionCard popover pattern. */
export function TileMoreMenu({
  habitId,
  habitName,
  dayLabel,
  skipped,
  disabled,
  showEditItem,
  onSkipToggle,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Reorder mode disables (and hides) the menu — no state sync needed, the
  // open popover simply isn't rendered while disabled. The open change is
  // reported as false while disabled so the tile drops its z-lift too.
  useEffect(() => {
    onOpenChange?.(open && !disabled)
  }, [open, disabled, onOpenChange])

  // Outside click + Escape close.
  useEffect(() => {
    if (!open || disabled) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, disabled])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={`More actions for ${habitName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`tile-more relative grid size-11 place-items-center rounded-pill text-fg-muted transition-opacity duration-150 hover:bg-surface hover:text-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <IconMore className="size-4" />
      </button>
      {open && !disabled && (
        <div
          role="menu"
          aria-label={`Actions for ${habitName}`}
          className="glass-card popover-solid absolute right-0 top-[calc(100%+4px)] z-20 w-44 max-w-[min(11rem,calc(100vw-2.5rem))] rounded-input p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onSkipToggle()
            }}
            className="flex h-11 w-full items-center rounded-input px-3 text-body text-fg transition-colors duration-150 hover:bg-surface-raised"
          >
            {skipped ? 'Undo skip' : `Skip ${dayLabel}`}
          </button>
          {showEditItem && (
            <Link
              role="menuitem"
              to={`/habits/${habitId}/edit`}
              onClick={() => setOpen(false)}
              className="flex h-11 w-full items-center rounded-input px-3 text-body text-fg transition-colors duration-150 hover:bg-surface-raised"
            >
              Edit habit
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
