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

/** Profile banner (DESIGN.md §11): glass banner with a square-grid pattern and
 *  an aurora fade, overlapping avatar with camera button, name + verified
 *  badge, email, and a remove-photo action. */
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
  const [imgBroken, setImgBroken] = useState(false)
  const hasPhoto = avatarPath != null && avatarUrl != null && !imgBroken
  const displayName = name?.trim() || email?.split('@')[0] || 'Profile'
  const initials = initialsFrom(name, email)

  // Reset the broken-image fallback whenever a new photo arrives.
  useEffect(() => setImgBroken(false), [avatarUrl, avatarPath])

  return (
    <section aria-label="Profile header">
      {/* Banner: 120px mobile / 160px desktop, grid pattern + aurora fade */}
      <div className="banner-grid glass-card relative h-[120px] overflow-hidden rounded-card lg:h-[160px]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 78%)',
          }}
        />
      </div>

      {/* Overlapping avatar + identity block, centered like the 720px card */}
      <div className="mx-auto -mt-12 flex w-full max-w-[720px] flex-col items-center gap-2 lg:mt-[-60px]">
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
          {/* 36px camera button; invisible pseudo extends the hit area to 44px */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={hasPhoto ? 'Change photo' : 'Upload photo'}
            title={hasPhoto ? 'Change photo' : 'Upload photo'}
            className="glass-pill absolute bottom-1 right-1 z-10 grid size-9 place-items-center rounded-full text-fg-secondary transition-colors duration-150 after:absolute after:-inset-1 after:content-[''] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 disabled:opacity-60"
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

        {avatarPath != null && (
          <button
            type="button"
            onClick={onRemove}
            disabled={uploading}
            className="text-body mt-1 inline-flex h-11 items-center rounded-pill px-4 font-medium text-danger transition-colors duration-150 hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none active:scale-95 disabled:opacity-60"
          >
            Remove photo
          </button>
        )}
      </div>
    </section>
  )
}
