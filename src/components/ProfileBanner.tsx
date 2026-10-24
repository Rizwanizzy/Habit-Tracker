import { useEffect, useRef, useState } from 'react'
import { initialsFrom } from '../lib/profile'
import { IconCamera, IconUser } from './icons'

interface Props {
  name: string | null
  email: string | null
  emailConfirmed: boolean
  avatarPath: string | null
  avatarUrl: string | null
  uploading: boolean
  onPickFile: (file: File) => void
  onRemove: () => void
}

/** Profile banner (DESIGN.md §11): full-width grid background with a radial
 *  mask fade, avatar sitting on top of the grid (~24px from top), name +
 *  verified badge + email below it. The camera button opens a keyboard-
 *  accessible popover with "Change photo" and "Remove photo" actions. */
export function ProfileBanner({
  name,
  email,
  emailConfirmed,
  avatarPath,
  avatarUrl,
  uploading,
  onPickFile,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const [imgBroken, setImgBroken] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const hasPhoto = avatarPath != null && avatarUrl != null && !imgBroken
  const displayName = name?.trim() || email?.split('@')[0] || 'Profile'
  const initials = initialsFrom(name, email)

  // Reset the broken-image fallback whenever a new photo arrives.
  useEffect(() => setImgBroken(false), [avatarUrl, avatarPath])

  // Close popover on outside click.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverOpen && avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
        setConfirmRemove(false)
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
        setConfirmRemove(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleConfirmRemove() {
    setConfirmRemove(false)
    setPopoverOpen(false)
    onRemove()
  }

  return (
    <section aria-label="Profile header">
      {/* Banner: full-width grid background, no border, no glass-card, no radius */}
      <div className="banner-grid banner-bg w-full h-[120px] lg:h-[160px]" />

      {/* Avatar + identity block on top of the grid, ~24px from the top */}
      <div className="mx-auto mt-6 flex w-full max-w-[720px] flex-col items-center gap-4 lg:mt-8" ref={avatarRef}>
        <div className="relative shrink-0">
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
          {/* Camera button: opens the popover menu */}
          <button
            type="button"
            onClick={() => setPopoverOpen((p) => !p)}
            disabled={uploading}
            aria-label={hasPhoto ? 'Change photo' : 'Upload photo'}
            title={hasPhoto ? 'Change photo' : 'Upload photo'}
            aria-haspopup="menu"
            aria-expanded={popoverOpen}
            className="glass-pill absolute bottom-1 right-1 z-20 grid size-9 place-items-center rounded-full text-fg-secondary transition-colors duration-150 after:absolute after:-inset-1 after:content-[''] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 disabled:opacity-60"
          >
            <IconCamera className="size-4" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute size-0 overflow-hidden opacity-0"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onPickFile(file)
              e.target.value = ''
            }}
          />
          {/* Popover menu: Change photo / Remove photo */}
          {popoverOpen && (
            <div
              className="glass-pill absolute bottom-[-56px] right-0 z-20 w-48 rounded-pill border border-border shadow-lg flex flex-col"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                  setPopoverOpen(false)
                }}
                className="flex items-center gap-2 px-4 py-2 text-body text-fg hover:bg-surface-raised"
              >
                <IconCamera className="size-4" />
                Change photo
              </button>
              {hasPhoto && (
                <>
                  <div className="border-t border-border" />
                  {confirmRemove ? (
                    <>
                      <p className="px-4 py-2 text-caption text-fg-secondary">Remove this photo?</p>
                      <div className="flex gap-2 px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(false)}
                          className="flex-1 py-1.5 text-caption text-fg-secondary hover:bg-surface-raised rounded-pill"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmRemove}
                          className="flex-1 py-1.5 text-caption text-danger hover:bg-danger/10 rounded-pill"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(true)}
                      className="flex items-center gap-2 px-4 py-2 text-body text-danger hover:bg-danger/10"
                    >
                      <span className="size-4" aria-hidden="true">
                        🗑️
                      </span>
                      Remove photo
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-2 px-4 text-center">
          <h1 className="text-page-title truncate">{displayName}</h1>
          {emailConfirmed && (
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" role="img" aria-label="Email verified">
              <circle cx="12" cy="12" r="10" fill="#3B82F6" />
              <path
                d="m8.4 12.4 2.4 2.4 4.8-5.2"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <p className="max-w-full px-4 text-center text-body text-fg-secondary">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <IconUser className="size-3.5 shrink-0 text-fg-muted" />
            <span className="truncate">{email}</span>
          </span>
        </p>
      </div>
    </section>
  )
}
