import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconSkip, IconX } from './icons'

/** Viewport-space anchor of the date cell that opened the popup. */
export interface MatrixCellMenuAnchor {
  top: number
  left: number
  width: number
  height: number
}

interface Props {
  anchor: MatrixCellMenuAnchor
  habitName: string
  /** Full date label, used only for the accessible menu name. */
  dateLabel: string
  /** 'skip' for a pending day, 'unskip' for an existing skipped day. */
  action: 'skip' | 'unskip'
  /** Runs the EXISTING skip / undo-skip handler, then closes the menu. */
  onAction: () => void
  /** restoreFocus = true for keyboard dismissal / after an action. The
   *  optional second flag eats the click that follows an outside press
   *  (the dismissing tap on the chip must not also toggle it). */
  onClose: (restoreFocus: boolean, swallowNextClick?: boolean) => void
}

/** Compact long-press / right-click popup for ONE Matrix date cell (Task 1).
 *  Visually mirrors the tile's `TileMoreMenu` (glass popover, 44px rows,
 *  15px labels, muted icons), but it is anchored to the tapped CHIP rather
 *  than a three-dot trigger.
 *
 *  Rendered in a `document.body` portal with fixed positioning, so it can
 *  never grow the locked 40px matrix row, push the date table wider, or join
 *  the horizontal scroller — the popup floats above everything and the matrix
 *  keeps scrolling underneath. It closes on scroll/resize (the anchor chip
 *  moves away), on an outside press, and on Escape; arrow keys / Home / End
 *  move between the two items and focus returns to the chip. */
export function MatrixCellMenu({
  anchor,
  habitName,
  dateLabel,
  action,
  onAction,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = useRef(0)

  // Position below the chip, centred on it, clamped inside the viewport and
  // above the floating mobile dock; flip above the chip when there is no room.
  const menuWidth = Math.min(176, window.innerWidth - 32)
  const menuHeight = 98 // 2 × 44px rows + 10px padding/border
  const margin = 16
  const dockMargin = window.innerWidth < 1024 ? 80 : 16
  let left = anchor.left + anchor.width / 2 - menuWidth / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin))
  const below = anchor.top + anchor.height + 6
  const above = anchor.top - 6 - menuHeight
  const top =
    below + menuHeight > window.innerHeight - dockMargin && above >= margin
      ? above
      : Math.min(below, Math.max(margin, window.innerHeight - menuHeight - dockMargin))

  useEffect(() => {
    itemRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    // Pointerdown (not mousedown) for outside dismissal: after a touch
    // long-press the browser replays a compatibility mousedown on the chip
    // when the finger lifts, which would close the just-opened popup.
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose(false, true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose(true)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        activeIndex.current = (activeIndex.current + 1) % 2
        itemRefs.current[activeIndex.current]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        activeIndex.current = (activeIndex.current - 1 + 2) % 2
        itemRefs.current[activeIndex.current]?.focus()
      } else if (e.key === 'Home') {
        e.preventDefault()
        activeIndex.current = 0
        itemRefs.current[0]?.focus()
      } else if (e.key === 'End') {
        e.preventDefault()
        activeIndex.current = 1
        itemRefs.current[1]?.focus()
      }
    }
    // The anchor chip scrolls away with the matrix — dismiss rather than
    // leave a detached popup floating over unrelated content.
    const dismiss = () => onClose(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [onClose])

  const itemClass =
    'flex h-11 w-full items-center gap-2.5 rounded-input px-3 text-left text-[15px] text-fg transition-colors duration-150 hover:bg-surface-raised focus:bg-surface-raised focus:outline-none'

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${habitName}, ${dateLabel}`}
      style={{ top, left, width: menuWidth }}
      className="glass-card popover-solid fixed z-[60] min-w-[176px] max-w-[calc(100vw-32px)] rounded-input p-1 shadow-xl"
    >
      <button
        ref={(el) => {
          itemRefs.current[0] = el
        }}
        type="button"
        role="menuitem"
        tabIndex={0}
        onClick={() => onAction()}
        onFocus={() => {
          activeIndex.current = 0
        }}
        className={itemClass}
      >
        <IconSkip className="size-[18px] shrink-0 text-fg-muted" />
        <span className="truncate">{action === 'skip' ? 'Skip this day' : 'Remove skip'}</span>
      </button>
      <button
        ref={(el) => {
          itemRefs.current[1] = el
        }}
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={() => onClose(true)}
        onFocus={() => {
          activeIndex.current = 1
        }}
        className={itemClass}
      >
        <IconX className="size-[18px] shrink-0 text-fg-muted" />
        <span className="truncate">Cancel</span>
      </button>
    </div>,
    document.body,
  )
}
