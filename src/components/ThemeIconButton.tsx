import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../lib/color'
import { IconCheck, IconMoon, IconSun } from './icons'

interface Props {
  /** Disabled while reorder (jiggle) mode is active, like other Today controls. */
  disabled?: boolean
  className?: string
}

interface ThemeChoice {
  id: Theme
  label: string
  sublabel: string
  swatchBg: string
  swatchBorder: string
  splitBg?: string
  accent: string
}

const CHOICES: ThemeChoice[] = [
  {
    id: 'system',
    label: 'System',
    sublabel: 'Auto device',
    swatchBg: '#f8fafc',
    splitBg: '#070a12',
    swatchBorder: 'rgba(125, 211, 252, 0.45)',
    accent: '#6366f1',
  },
  {
    id: 'light',
    label: 'Light',
    sublabel: 'Aurora Glass',
    swatchBg: '#f3f7fc',
    swatchBorder: 'rgba(15, 23, 42, 0.12)',
    accent: '#4f46e5',
  },
  {
    id: 'dark',
    label: 'Dark',
    sublabel: 'Aurora Glass',
    swatchBg: '#070a12',
    swatchBorder: 'rgba(255, 255, 255, 0.15)',
    accent: '#7c83ff',
  },
  {
    id: 'sepia',
    label: 'Sepia',
    sublabel: 'Warm parchment',
    swatchBg: '#f5eee6',
    swatchBorder: 'rgba(74, 52, 34, 0.22)',
    accent: '#c26522',
  },
  {
    id: 'oled',
    label: 'OLED',
    sublabel: 'True black',
    swatchBg: '#000000',
    swatchBorder: 'rgba(255, 255, 255, 0.18)',
    accent: '#818cf8',
  },
  {
    id: 'solarized',
    label: 'Solarized',
    sublabel: 'Auto palette',
    swatchBg: '#fdf6e3',
    splitBg: '#002b36',
    swatchBorder: 'rgba(147, 161, 161, 0.28)',
    accent: '#2aa198',
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    sublabel: 'WCAG AAA',
    swatchBg: '#000000',
    swatchBorder: '#ffffff',
    accent: '#00e5ff',
  },
]

/** Theme icon button for the Today header: preserves the circular glass icon
 *  showing the rotating sun/moon glyph, and opens a clamped, portalled theme
 *  menu on tap for all 7 appearance themes with an instant 1-tap quick toggle.
 *  Double-clicking triggers quick toggle directly. */
export function ThemeIconButton({ disabled = false, className = '' }: Props) {
  const { theme, dark, toggle, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Double click for instant quick toggle
  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(false)
    toggle()
  }

  // Anchor and clamp popover relative to the trigger button
  useEffect(() => {
    if (!open || disabled) {
      setPos(null)
      return
    }

    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const menuWidth = Math.min(236, window.innerWidth - 24)
      const menuHeight = 350
      const margin = 12
      const dockMargin = window.innerWidth < 1024 ? 76 : 16

      let left = r.right - menuWidth
      left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin))

      let top: number
      if (
        r.bottom + 6 + menuHeight > window.innerHeight - dockMargin &&
        r.top - 6 - menuHeight >= margin
      ) {
        top = r.top - 6 - menuHeight
      } else {
        top = Math.min(r.bottom + 6, window.innerHeight - menuHeight - dockMargin)
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

  // Dismiss on outside click and Escape key
  useEffect(() => {
    if (!open || disabled) return

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, disabled])

  function handleSelect(id: Theme) {
    setTheme(id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleQuickToggle() {
    toggle()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onDoubleClick={handleDoubleClick}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Appearance settings"
        title="Appearance settings (double-click to quick toggle)"
        className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-raised text-fg-secondary transition-colors duration-150 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
          className || 'size-11 lg:size-13'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute grid place-items-center transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
            dark ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0'
          }`}
        >
          <IconSun className="size-6" />
        </span>
        <span
          aria-hidden="true"
          className={`absolute grid place-items-center transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
            dark ? '-rotate-90 opacity-0' : 'rotate-0 opacity-100'
          }`}
        >
          <IconMoon className="size-6" />
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Choose appearance theme"
            className="glass-card popover-solid fixed z-50 flex flex-col gap-1 rounded-card p-2 shadow-2xl"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
            }}
          >
            {/* Header with Quick Toggle */}
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-1.5 pb-2">
              <span className="text-[12px] font-semibold text-fg-muted uppercase tracking-wider">
                Appearance
              </span>
              <button
                type="button"
                onClick={handleQuickToggle}
                className="inline-flex items-center gap-1.5 rounded-pill bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
                title="Toggle between light and dark"
              >
                {dark ? <IconSun className="size-3" /> : <IconMoon className="size-3" />}
                <span>{dark ? 'Light mode' : 'Dark mode'}</span>
              </button>
            </div>

            {/* List of 7 options */}
            <div role="radiogroup" aria-label="Themes" className="mt-1 flex flex-col gap-0.5">
              {CHOICES.map((opt) => {
                const isSelected = theme === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelect(opt.id)}
                    className={`flex items-center gap-2.5 rounded-input px-2.5 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-accent/12 font-medium text-accent'
                        : 'text-fg hover:bg-surface-raised'
                    }`}
                  >
                    {/* Mini Swatch */}
                    <div
                      className="relative size-5 shrink-0 overflow-hidden rounded-full shadow-inner"
                      style={{
                        backgroundColor: opt.swatchBg,
                        border: `1px solid ${opt.swatchBorder}`,
                      }}
                      aria-hidden="true"
                    >
                      {opt.splitBg && (
                        <div
                          className="absolute inset-y-0 right-0 w-1/2"
                          style={{ backgroundColor: opt.splitBg }}
                        />
                      )}
                      <div
                        className="absolute inset-0 m-auto size-1.5 rounded-full"
                        style={{ backgroundColor: opt.accent }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[13px] leading-tight font-medium">
                          {opt.label}
                        </span>
                        {isSelected && <IconCheck className="size-3.5 shrink-0 stroke-[2.5]" />}
                      </div>
                      <span className="block truncate text-[11px] text-fg-muted">
                        {opt.sublabel}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
