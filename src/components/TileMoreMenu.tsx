import { createPortal } from 'react-dom'
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
 *  click and Escape close it — the CompletionCard popover pattern.
 *
 *  Portalled + clamped to the viewport so a tile in the first column on a
 *  360px phone doesn't crop half the menu off the left edge. */
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Reorder mode disables (and hides) the menu — no state sync needed, the
  // open popover simply isn't rendered while disabled. The open change is
  // reported as false while disabled so the tile drops its z-lift too.
  useEffect(() => {
    onOpenChange?.(open && !disabled)
  }, [open, disabled, onOpenChange])

  // Anchor under the trigger, right-aligned, clamped inside the viewport.
  useEffect(() => {
    if (!open || disabled) {
      setPos(null)
      return
    }
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const width = 108 // ~20% wider than 88px for comfortable reading
      const margin = 8
      let left = r.right - width
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
      setPos({ top: r.bottom + 4, left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, disabled])

  // Outside click + Escape close. Clicks on the trigger itself are ignored
  // here so the button's own toggle still works.
  useEffect(() => {
    if (!open || disabled) return
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
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

  const close = () => setOpen(false)

  return (
    <div className="relative">
      <button
        ref={triggerRef}
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
      {open && !disabled && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${habitName}`}
          style={{ top: pos.top, left: pos.left }}
          className="glass-card popover-solid fixed z-50 w-[108px] max-w-[min(6.75rem,calc(100vw-2rem))] rounded-input p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              onSkipToggle()
            }}
            className="flex h-11 w-full items-center justify-center rounded-input px-2.5 text-[13px] text-fg transition-colors duration-150 hover:bg-surface-raised"
          >
            {skipped ? 'Undo skip' : `Skip ${dayLabel}`}
          </button>
          {showEditItem && (
            <Link
              role="menuitem"
              to={`/habits/${habitId}/edit`}
              onClick={close}
              className="flex h-11 w-full items-center justify-center rounded-input px-2.5 text-[13px] text-fg transition-colors duration-150 hover:bg-surface-raised"
            >
              Edit habit
            </Link>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
