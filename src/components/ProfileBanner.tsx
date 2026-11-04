import { useEffect, useRef, useState } from 'react'
import { initialsFrom } from '../lib/profile'
import { ConfirmDialog } from './ConfirmDialog'
import { IconCamera, IconPencil, IconTrash, IconUser } from './icons'
import { VerifiedBadge } from './VerifiedBadge'

interface Props {
  name: string | null
  email: string | null
  emailConfirmed: boolean
  bio?: string | null
  avatarPath: string | null
  avatarUrl: string | null
  uploading: boolean
  onPickFile: (file: File) => void
  onRemove: () => void
  onAddBio?: () => void
  /** Toast overlay rendered ON the name + verified-badge row (user request:
   *  warnings belong where the eyes are — viewport-bottom/top placements went
   *  unseen). Centering inside this row also aligns to the CONTENT column,
   *  fixing the "slightly left" look of viewport-wide centering on desktop. */
  notice?: { kind: 'success' | 'danger'; text: string } | null
}

/** Profile banner (DESIGN.md §11): full-width grid background with a radial
 *  mask fade, avatar sitting on top of the grid (~24px from top), name +
 *  verified badge + email below it. The camera button opens a keyboard-
 *  accessible popover with "Change photo" and "Remove photo" actions. */
export function ProfileBanner({
  name,
  email,
  emailConfirmed,
  bio = null,
  avatarPath,
  avatarUrl,
  uploading,
  onPickFile,
  onRemove,
  onAddBio,
  notice = null,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [imgBroken, setImgBroken] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [confirmRemoveDialog, setConfirmRemoveDialog] = useState(false)
  const hasPhoto = avatarPath != null && avatarUrl != null && !imgBroken
  const displayName = name?.trim() || email?.split('@')[0] || 'Profile'
  const initials = initialsFrom(name, email)

  // Reset the broken-image fallback whenever a new photo arrives.
  useEffect(() => setImgBroken(false), [avatarUrl, avatarPath])

  // Close popover on outside click. The "inside" region is only the small
  // avatar wrapper (photo + camera button + menu): checking the wider
  // identity column left the popover open for taps in the empty space
  // around the avatar (user report — that column box is up to 720px wide).
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
        setConfirmRemoveDialog(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [popoverOpen])

  // Close popover on Escape.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopoverOpen(false)
        setConfirmRemoveDialog(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleConfirmRemove() {
    setConfirmRemoveDialog(false)
    setPopoverOpen(false)
    onRemove()
  }

  return (
    <section aria-label="Profile header">
      {/* Banner container: relative so avatar can overlap the grid area */}
      <div className="relative w-full">
        {/* Banner: full-width grid background, no border, no glass-card, no radius */}
        <div className="banner-grid banner-bg w-full h-[20px] lg:h-[28px]" />

        {/* Avatar + identity block overlapping the bottom of the grid area */}
        <div className="mx-auto -mt-6 flex w-full max-w-[720px] flex-col items-center gap-4 lg:-mt-12 lg:mt-0">
        <div className="relative shrink-0" ref={menuRef}>
          {hasPhoto ? (
            <img
              src={avatarUrl}
              alt="Profile photo"
              className="size-24 rounded-full object-cover ring-4 ring-background lg:size-[120px]"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <div
              aria-hidden="true"
              className="bg-accent-gradient glow-accent grid size-24 place-items-center rounded-full ring-4 ring-background lg:size-[120px]"
            >
              <span className="text-stat text-white">{initials}</span>
            </div>
          )}
          <span
            aria-hidden="true"
            className="glow-accent pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 24px color-mix(in srgb, var(--accent) 45%, transparent)' }}
          />
          {uploading && (
            <svg viewBox="0 0 100 100" aria-hidden="true" className="progress-spin absolute -inset-2">
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="220 76"
              />
            </svg>
          )}
          {/* Camera button: opens the popover menu. Solid chip (not glass):
              translucent glass disappears against the avatar's saturated
              gradient, especially in dark theme (user report) —
              --surface-solid is the opaque popover fill, readable in both
              themes on top of the glow. */}
          <button
            type="button"
            onClick={() => setPopoverOpen((p) => !p)}
            disabled={uploading}
            aria-label={hasPhoto ? 'Change photo' : 'Upload photo'}
            title={hasPhoto ? 'Change photo' : 'Upload photo'}
            aria-haspopup="menu"
            aria-expanded={popoverOpen}
            style={{ backgroundColor: 'var(--surface-solid)' }}
            className="absolute bottom-1 right-1 z-20 grid size-9 place-items-center rounded-full border border-border shadow-md text-fg-secondary transition-all duration-150 after:absolute after:-inset-1 after:content-[''] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 disabled:opacity-60"
          >
            <IconCamera className="size-4" />
          </button>
          {/* Deliberately accept="image/*": a restrictive list made the iOS
              Photos picker silently refuse unseen formats/oversize originals
              (e.g. 29 MB ProRAW/HEIC) BEFORE our code ran — never fired,
              never warned (user report). Everything the OS hands us is
              validated in prepareAvatar, which messages every rejection. */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute size-0 overflow-hidden opacity-0"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onPickFile(file)
              e.target.value = ''
            }}
          />
          {/* Popover menu: Change photo / Remove photo. `popover-solid` —
              the same OPAQUE glass fill the Day-start listbox uses, because
              translucent glass is unreadable over the banner (user report). */}
          {popoverOpen && (
            <div
              className="glass-card popover-solid absolute bottom-[-60px] right-0 z-20 flex w-48 flex-col rounded-input border border-border shadow-xl"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                  setPopoverOpen(false)
                }}
                className="flex min-h-11 items-center gap-2.5 px-4 py-2 text-body text-fg transition-colors duration-150 hover:bg-surface-raised"
              >
                <IconCamera className="size-4" />
                Change photo
              </button>
              {hasPhoto && (
                <>
                  <div className="border-t border-border" />
                  <button
                    type="button"
                    onClick={() => {
                      setPopoverOpen(false)
                      setConfirmRemoveDialog(true)
                    }}
                    className="flex min-h-11 items-center gap-2.5 px-4 py-2 text-body text-danger transition-colors duration-150 hover:bg-danger/10"
                  >
                    <IconTrash className="size-4" />
                    Remove photo
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-1 flex flex-col items-center gap-2 px-4 w-full text-center">
          <div className="relative inline-flex items-center justify-center gap-2 min-w-0 w-full">
            <h1 className="text-page-title truncate overflow-hidden whitespace-nowrap min-w-0 max-w-[calc(100%-26px)]">{displayName}</h1>
            {emailConfirmed && <VerifiedBadge size={22} className="shrink-0" />}
            {/* Toast sits on the name + badge row itself (see Props doc). */}
            {notice && (
              <div
                role="status"
                className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center"
              >
                <p
                  className={`glass-pill popover-solid rounded-pill px-5 py-2.5 text-center text-body font-medium shadow-lg ${
                    notice.kind === 'success' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {notice.text}
                </p>
              </div>
            )}
          </div>
          <p className="text-center text-body text-fg-secondary w-full min-w-0 overflow-hidden whitespace-nowrap truncate">
            <span className="inline-flex items-center gap-1 min-w-0">
              <IconUser className="size-3.5 shrink-0 text-fg-muted" />
              <span className="truncate">{email}</span>
            </span>
          </p>
          {bio ? (
            <p className="max-w-[540px] text-center text-sm italic text-fg-secondary line-clamp-3 break-words px-2">
              “{bio}”
            </p>
          ) : (
            <button
              type="button"
              onClick={onAddBio}
              className="inline-flex h-11 items-center gap-2 rounded-pill border border-dashed border-border px-4 text-sm font-medium text-fg-secondary transition-colors hover:border-fg-secondary hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <IconPencil className="size-4 shrink-0" />
              <span>Add your quote</span>
            </button>
          )}
        </div>
      </div>
    </div>

      <ConfirmDialog
        open={confirmRemoveDialog}
        onClose={() => setConfirmRemoveDialog(false)}
        title="Remove photo?"
        description="This will delete your profile picture and cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Remove"
        danger
        onConfirm={handleConfirmRemove}
      />
    </section>
  )
}
