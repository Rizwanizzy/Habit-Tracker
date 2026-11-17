import { useEffect, useRef, useState } from 'react'
import { IconInfo } from './icons'

/** UI 2.0 Stage 2 — replaces the persistent ">7 habits / shared rings"
 *  caption: a small info button near the ring visualization opening a
 *  dismissible popover that explains how the rings work. Purely
 *  presentational — the ring allocation itself (src/lib/rings.ts) is
 *  untouched.
 *
 *  Interaction mirrors the repo's proven popover patterns (TileMoreMenu /
 *  CompletionCard): click/tap toggles, Escape and outside click dismiss,
 *  `aria-expanded`/`aria-controls` on the button. Transitions are token-
 *  based and killed globally under reduced motion. */

interface Props {
  /** Habits beyond the 28-shown cap (0 for almost everyone) — surfaced as a
   *  factual extra line inside the popover instead of the removed caption. */
  hiddenCount?: number
}

export function RingExplainer({ hiddenCount = 0 }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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
  }, [open])

  return (
    /* Root is an OVERLAY anchored to the hero card's top-right corner —
       Today.tsx's section carries `relative` and is the positioning
       reference — with a small 8px inset from the card edges. This is the
       card's existing empty space on BOTH viewports: on mobile the ring
       container keeps its production fixed size and even in the worst case
       (rings flush with the content top, e.g. vacation) the 16px glyph
       clears the arc's shoulder by ≥7px; on desktop the rings live on the
       LEFT and the vertically-centered stat block leaves the top-right
       free. The previously-tried in-flow icon row grew the card — card
       dimensions must match production exactly, so the icon overlaps
       nothing by sitting in the corner pocket instead. While open, the
       `ring-explainer-open` class lets index.css lift the hero glass-card
       above its sibling cards (:has() rule) so this popover paints over
       the heatmap card instead of under it. */
    <div ref={rootRef} className={`absolute top-2 right-2 z-20${open ? ' ring-explainer-open' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ring-explainer"
        aria-label="How progress rings work"
        title="How progress rings work"
        className="grid size-7 place-items-center rounded-full text-fg-muted transition-colors duration-150 hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <IconInfo className="size-4" />
      </button>
      {open && (
        <div
          id="ring-explainer"
          role="note"
          aria-label="How progress rings work"
          className="glass-card popover-solid absolute right-0 top-9 z-30 w-[236px] rounded-card p-3.5 shadow-xl"
        >
          <p className="text-caption text-fg">How progress rings work</p>
          <p className="mt-1.5 text-[12px] leading-snug text-fg-secondary">
            Up to seven habits can each have their own ring. With more habits, rings are shared
            using separate colored segments. Segments follow your habit order.
          </p>
          {hiddenCount > 0 && (
            <p className="mt-1.5 text-[12px] leading-snug text-fg-secondary">
              {hiddenCount} more habits are not shown in the rings.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
