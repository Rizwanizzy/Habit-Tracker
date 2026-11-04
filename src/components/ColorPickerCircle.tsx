import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ColorPicker } from './ColorPicker'

interface Props {
  color: string
  onChange: (hex: string) => void
}

/** The phone form's COLOR row control (HabitFormMobile): a single 40px
 *  circle filled with the habit color + 2px ring, opening the shared
 *  ColorPicker in a `popover-solid` popover — CompletionCard palette-
 *  popover behaviour (viewport-clamped, right-aligned to the circle, flips
 *  above it when there is no room below, outside tap / Escape close,
 *  scrolls with the trigger; z-50 stays above the dock). Preset swatches
 *  close the popover shortly after; the custom picker and hex field keep
 *  it open. */
export function ColorPickerCircle({ color, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)

  /* Preset pick → apply (ColorPicker calls onChange itself) → close in ~120ms. */
  const onPreset = () => {
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120)
  }

  useEffect(
    () => () => window.clearTimeout(closeTimerRef.current),
    [],
  )
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  /* Position: below the circle by default, above when cramped heuristics
     say the ~220px popover won't fit; clamped to a 16px viewport margin and
     re-checked on scroll (capture — main is the scroll container on phones)
     and resize. */
  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(320, window.innerWidth - 32) // max-width 100vw−32px
      const margin = 16
      const left = Math.max(margin, Math.min(r.right - width, window.innerWidth - width - margin))
      const below = window.innerHeight - r.bottom - 16
      const above = r.top - 16
      const openUp = below < 220 && above > below
      setPos({ top: openUp ? Math.max(8, r.top - 228) : r.bottom + 8, left, width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])
  /* Outside tap / Escape close (CompletionCard palette-popover pattern). */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (popRef.current?.contains(e.target as Node)) return
      setOpen(false)
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
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change habit color"
        aria-expanded={open}
        className="relative grid size-10 shrink-0 place-items-center rounded-full transition-transform duration-150 active:scale-95 after:absolute after:-inset-1.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        style={{
          backgroundColor: color,
          border: '2px solid color-mix(in srgb, var(--text-primary) 22%, transparent)',
        }}
      />
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Choose a color"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className="glass-card popover-solid z-50 rounded-card p-4 shadow-xl"
          >
            <ColorPicker color={color} onChange={onChange} onPreset={onPreset} />
          </div>,
          document.body,
        )}
    </>
  )
}
