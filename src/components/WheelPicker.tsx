import { useLayoutEffect, useEffect, useRef } from 'react'
import { indexFromScroll, scrollTopForValue, WHEEL_ITEM_H } from '../lib/wheel'
import { tick } from '../lib/haptics'

interface Props {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  /** Accessible name ("Times", "Days"). */
  label: string
  className?: string
}

/** Alarm-clock wheel (HabitFormMobile phone layout): a 64×108px scroll-snap
 *  spinner. The row closest to the centre IS the value; every change fires a
 *  short haptic tick (a no-op on iOS Safari, which has no navigator.vibrate).
 *  Pure math lives in lib/wheel.ts and is unit-tested there. */
export function WheelPicker({ value, onChange, min, max, label, className = '' }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  /** Value last reported from a wheel-initiated scroll — lets the layout
   *  effect tell outside-driven value changes apart from its own output.
   *  Starts as null so the first layout effect always syncs (edit mode). */
  const lastLocalRef = useRef<number | null>(null)
  /** scrollTop the component itself is setting (load/keyboard sync), so the
   *  scroll event it triggers is not mistaken for a user scroll. */
  const programmaticRef = useRef<number | null>(scrollTopForValue(value, WHEEL_ITEM_H, min))
  /** Live props for the rAF callback without re-subscribing the listener. */
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const count = Math.max(0, max - min + 1)

  /** Centre `value` when it changes from OUTSIDE (load / other input),
   *  instantly and before first paint. A wheel-driven change passes through
   *  lastLocalRef first, so this never fights a mid-scroll snap. */
  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    const target = scrollTopForValue(value, WHEEL_ITEM_H, min)
    if (el.scrollTop === target) return
    if (value === lastLocalRef.current) return // our own scroll is settling
    lastLocalRef.current = value
    programmaticRef.current = target
    el.scrollTop = target
  }, [value, min])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  /** rAF-throttled scroll → nearest row → onChange (+ tick). */
  const onScroll = () => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = elRef.current
      if (!el) return
      const own = programmaticRef.current !== null && el.scrollTop === programmaticRef.current
      programmaticRef.current = null
      if (own) return
      const idx = indexFromScroll(el.scrollTop, WHEEL_ITEM_H, count)
      const next = min + idx
      if (next === lastLocalRef.current) return
      lastLocalRef.current = next
      if (next !== valueRef.current) {
        tick()
        onChangeRef.current(next)
      }
    })
  }

  /** Keyboard: ArrowUp/Down ±1, PageUp/PageDown ±5, Home/End clamp. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const from = valueRef.current
    let to: number | null = null
    if (e.key === 'ArrowUp') to = Math.min(max, from + 1)
    else if (e.key === 'ArrowDown') to = Math.max(min, from - 1)
    else if (e.key === 'PageUp') to = Math.min(max, from + 5)
    else if (e.key === 'PageDown') to = Math.max(min, from - 5)
    else if (e.key === 'Home') to = min
    else if (e.key === 'End') to = max
    if (to === null || to === from) return
    e.preventDefault()
    lastLocalRef.current = null
    programmaticRef.current = scrollTopForValue(to, WHEEL_ITEM_H, min)
    if (elRef.current) elRef.current.scrollTop = programmaticRef.current
    tick()
    onChangeRef.current(to)
  }

  /** Tap a non-selected row to bring it to the centre. The scroll itself
   *  reports the value (no double reporting); smooth unless reduced motion. */
  const onTap = (v: number) => {
    if (v === valueRef.current) return
    const el = elRef.current
    if (!el) return
    lastLocalRef.current = null
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.style.scrollBehavior = reduced ? 'auto' : 'smooth'
    el.scrollTop = scrollTopForValue(v, WHEEL_ITEM_H, min)
    el.style.scrollBehavior = ''
    tick()
  }

  return (
    <div className={`relative ${className}`}>
      {/* Fixed highlight band behind the centre row (surface-raised = the
          surface-2 token; bg-surface-2 alone generates no utility). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-9 -translate-y-1/2 rounded-input bg-surface-raised"
      />
      <div
        ref={elRef}
        onScroll={onScroll}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onKeyDown={onKeyDown}
        className="wheel-scroll relative z-10 h-[108px] w-16 snap-y snap-mandatory overflow-y-auto overscroll-contain touch-pan-y bg-transparent py-9 text-center focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        {Array.from({ length: count }, (_, i) => min + i).map((v) => (
          <button
            key={v}
            type="button"
            tabIndex={-1}
            aria-label={`${v}`}
            onClick={() => onTap(v)}
            style={{ height: WHEEL_ITEM_H }}
            className={`grid w-full snap-center place-items-center font-display text-[22px] leading-none tabular-nums ${
              v === value ? 'font-bold text-fg' : 'text-fg-secondary'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
