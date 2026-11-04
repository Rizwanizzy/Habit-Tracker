import { lazy, Suspense, useEffect, useRef, useState, Component, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { EmojiClickData } from 'emoji-picker-react'
import { useThemeName } from '../hooks/useThemeName'
import { normalizeEmoji } from '../lib/emoji'
import { IconSmileyPlus } from './icons'

/** The picker engine (search, categories, skin tones, recents) is lazy-loaded:
 *  it is a ~300 KB chunk that only matters while the panel is open. */
const EmojiPicker = lazy(() => import('emoji-picker-react'))

interface Props {
  /** Current emoji (may be typed free text while editing). */
  value: string
  /** Habit color, so the preview ring matches the tile. */
  color: string
  onChange: (emoji: string) => void
  /** Trigger shape. `pill` (default) is the original 44px glass pill;
   *  `circle` is the 52px round trigger used by the phone habit form. */
  variant?: 'pill' | 'circle'
}

/** Picker chunk failed (offline before the PWA cached it): say so instead of
 *  rendering an empty panel. */
class PickerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="grid h-full place-items-center px-6 text-center">
          <p className="text-body text-fg-secondary">
            The emoji picker could not load. Check your connection and reopen this panel.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

/** Emoji field for the habit form (DESIGN.md §6): a 44px pill that opens the
 *  full Unicode picker — an anchored glass popover on desktop and a bottom
 *  sheet on phones, so the keyboard never hides the grid on a 360px screen.
 *  Cells are 44px (`--epr-emoji-size` 28 + padding 8) and the picker follows
 *  the light/dark theme. The free-text input in the form stays for pasting.
 *  The `circle` variant replaces the pill on the phone form layout. */
export function EmojiPickerField({ value, color, onChange, variant = 'pill' }: Props) {
  const [open, setOpen] = useState(false)
  const [desktop, setDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 640px)').matches,
  )
  const [pos, setPos] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Breakpoint state: the popover anchor only exists on sm+.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setDesktop(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Desktop: anchor under the trigger, flip above when the page is short and
  // clamp inside the viewport. Recomputed on resize/scroll while open.
  useEffect(() => {
    if (!open || !desktop) return
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(392, window.innerWidth - 16)
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
      const below = window.innerHeight - rect.bottom - 12
      const above = rect.top - 12
      const openUp = below < 320 && above > below
      const height = Math.min(470, Math.max(250, openUp ? above - 8 : below - 8))
      const top = openUp ? Math.max(8, rect.top - height - 8) : rect.bottom + 8
      setPos({ top, left, width, height })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, desktop])

  // Escape closes; clicks outside the panel close; the page behind is locked.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Return focus to the trigger so keyboard users stay where they were.
  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const pick = (data: EmojiClickData) => {
    const emoji = normalizeEmoji(data.emoji)
    if (emoji) onChange(emoji)
    close()
  }

  const shown = normalizeEmoji(value)

  const panel = (
    <>
      <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2">
        <span className="text-caption font-semibold text-fg-secondary">Choose an emoji</span>
        <div className="flex items-center gap-1">
          {shown && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                close()
              }}
              className="glass-pill h-9 rounded-pill px-3 text-caption text-fg-secondary transition-colors duration-150 hover:text-fg"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="glass-pill h-9 rounded-pill px-3 text-caption font-medium text-fg transition-colors duration-150 hover:text-fg-secondary"
          >
            Done
          </button>
        </div>
      </div>
      <div className="emoji-picker-panel min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center" role="status">
              <span className="text-body text-fg-muted">Loading emoji…</span>
            </div>
          }
        >
          <PickerBoundary>
            <PickerBody onPick={pick} autoFocusSearch={desktop} />
          </PickerBoundary>
        </Suspense>
      </div>
    </>
  )

  const trigger =
    variant === 'circle' ? (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setPos(null)
          setOpen(true)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={shown ? 'Change habit emoji' : 'Pick a habit emoji'}
        title={shown ? 'Change habit emoji' : 'Pick a habit emoji'}
        className={`relative glass-pill grid size-[52px] shrink-0 place-items-center rounded-full border-[1.5px] border-accent transition-all duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
          shown ? '' : 'glow-accent emoji-trigger-pulse'
        }`}
      >
        {shown ? (
          <span aria-hidden="true" className="text-2xl leading-none">
            {shown}
          </span>
        ) : (
          <>
            <span aria-hidden="true" className="text-2xl leading-none lg:hidden">
              🙂
            </span>
            <IconSmileyPlus className="hidden size-5 text-fg-muted lg:block" />
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-accent-gradient text-white ring-2 ring-background lg:hidden"
            >
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="size-2.5"
              >
                <path d="M6 2.5v7M2.5 6h7" />
              </svg>
            </span>
          </>
        )}
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setPos(null)
          setOpen(true)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={shown ? 'Change habit emoji' : 'Pick a habit emoji'}
        className="glass-pill inline-flex h-12 items-center gap-2 rounded-pill pl-2 pr-3.5 text-fg transition-colors duration-150 hover:text-fg-secondary"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full text-lg leading-none"
          style={
            shown
              ? {
                  border: `2px solid ${color}`,
                  backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                }
              : undefined
          }
        >
          {shown || '🙂'}
        </span>
        <span className="text-caption font-medium">{shown ? 'Change emoji' : 'Pick emoji'}</span>
      </button>
    )

  return (
    <>
      {trigger}

      {open &&
        createPortal(
          <>
            <div
              aria-hidden="true"
              onClick={close}
              className="fixed inset-0 z-40 bg-slate-950/45 sm:bg-transparent"
            />
            {desktop ? (
              pos && (
                <div
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Choose an emoji"
                  style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.height }}
                  className="glass-card popover-solid fixed z-50 flex flex-col overflow-hidden rounded-card p-1.5 shadow-2xl"
                >
                  {panel}
                </div>
              )
            ) : (
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Choose an emoji"
                className="glass-card popover-solid fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-card pb-[env(safe-area-inset-bottom)] shadow-2xl"
                style={{ height: 'min(70dvh, 620px)' }}
              >
                {/* Grab handle on the sheet. */}
                <span
                  aria-hidden="true"
                  className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-fg/25"
                />
                {panel}
              </div>
            )}
          </>,
          document.body,
        )}
    </>
  )
}

/** Managed picker: native rendering (the device's own emoji font), themed to
 *  our tokens via CSS, recents + skin tones on. */
function PickerBody({
  onPick,
  autoFocusSearch,
}: {
  onPick: (data: EmojiClickData) => void
  autoFocusSearch: boolean
}) {
  const theme = useThemeName()
  return (
    <EmojiPicker
      onEmojiClick={onPick}
      emojiStyle="native"
      colorScheme={theme}
      width="100%"
      height="100%"
      autoFocusSearch={autoFocusSearch}
      previewConfig={{ showPreview: false }}
      searchPlaceholder="Search emoji"
      searchClearButtonLabel="Clear search"
      lazyLoadEmojis
    />
  )
}
