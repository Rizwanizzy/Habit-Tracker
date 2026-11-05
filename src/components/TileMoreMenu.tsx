import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconMore, IconPencil, IconSkip } from './icons'

interface Props {
  habitId: string
  habitName: string
  /** "today" or a short date label for the "Skip <day>" item. */
  dayLabel: string
  skipped: boolean
  /** Reorder mode: the menu is disabled (and closed). */
  disabled: boolean
  onSkipToggle?: () => void
  /** Lets the tile lift itself above sibling contexts while open. */
  onOpenChange?: (open: boolean) => void
}

/** The habit tile's "more" popover (DESIGN.md §6): single icon button (three dots)
 *  opening a glass menu with "Edit habit" and "Skip <day>" / "Undo skip".
 *  Outside click and Escape close it, arrow keys navigate between items.
 *
 *  Portalled + clamped to the viewport and dock clearance so it opens fully visible. */
export function TileMoreMenu({
  habitId,
  habitName,
  dayLabel,
  skipped,
  disabled,
  onSkipToggle,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([])
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Reorder mode disables (and hides) the menu. The open change is
  // reported as false while disabled so the tile drops its z-lift too.
  useEffect(() => {
    onOpenChange?.(open && !disabled)
  }, [open, disabled, onOpenChange])

  // Reset active item index to 0 whenever opening.
  useEffect(() => {
    if (open) {
      setActiveIndex(0)
    }
  }, [open])

  // Move focus to the active menuitem when open and positioned.
  useEffect(() => {
    if (open && pos) {
      itemRefs.current[activeIndex]?.focus()
    }
  }, [open, activeIndex, pos])

  // Anchor relative to trigger, right-aligned by default, clamped inside viewport,
  // flipping upward if colliding with bottom dock or screen edge.
  useEffect(() => {
    if (!open || disabled) {
      setPos(null)
      return
    }
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const menuWidth = Math.min(176, window.innerWidth - 32)
      const menuHeight = 98 // 2 × 44px rows + 10px padding & border
      const margin = 16
      const dockMargin = window.innerWidth < 1024 ? 80 : 16

      let left = r.right - menuWidth
      left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin))

      let top: number
      if (r.bottom + 4 + menuHeight > window.innerHeight - dockMargin && r.top - 4 - menuHeight >= margin) {
        // Flip upward above the trigger button
        top = r.top - 4 - menuHeight
      } else {
        // Open downward under the trigger button
        top = Math.min(r.bottom + 4, window.innerHeight - menuHeight - dockMargin)
      }

      setPos({ top, left, width: menuWidth })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, disabled])

  // Outside click + Keyboard navigation (Escape closes & returns focus; Up/Down arrows navigate items).
  useEffect(() => {
    if (!open || disabled) return
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % 2)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + 2) % 2)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveIndex(1)
      }
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
    <div className="relative shrink-0">
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
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="glass-card popover-solid fixed z-[60] min-w-[176px] max-w-[calc(100vw-32px)] rounded-input p-1 shadow-xl"
        >
          <Link
            ref={(el) => { itemRefs.current[0] = el }}
            role="menuitem"
            to={`/habits/${habitId}/edit`}
            tabIndex={activeIndex === 0 ? 0 : -1}
            onClick={close}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                close()
              }
            }}
            className="flex h-11 w-full items-center gap-2.5 rounded-input px-3 text-left text-[15px] text-fg transition-colors duration-150 hover:bg-surface-raised focus:bg-surface-raised focus:outline-none"
          >
            <IconPencil className="size-[18px] shrink-0 text-fg-muted" />
            <span className="truncate">Edit habit</span>
          </Link>
          <button
            ref={(el) => { itemRefs.current[1] = el }}
            type="button"
            role="menuitem"
            tabIndex={activeIndex === 1 ? 0 : -1}
            onClick={() => {
              close()
              onSkipToggle?.()
            }}
            className="flex h-11 w-full items-center gap-2.5 rounded-input px-3 text-left text-[15px] text-fg transition-colors duration-150 hover:bg-surface-raised focus:bg-surface-raised focus:outline-none"
          >
            <IconSkip className="size-[18px] shrink-0 text-fg-muted" />
            <span className="truncate">{skipped ? 'Undo skip' : `Skip ${dayLabel}`}</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
