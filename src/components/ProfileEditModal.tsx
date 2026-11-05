import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import type { Profile, ProfileInput } from '../lib/profile'
import { ProfileEditFields } from './ProfileDetailsEdit'

interface Props {
  open: boolean
  profile: Profile | null
  saving: boolean
  focusBio?: boolean
  onCancel: () => void
  onSave: (input: ProfileInput) => Promise<void>
}

/** ProfileEditModal (DESIGN.md §11): Desktop edit modal rendered via createPortal into document.body.
 *  Maintains the card behind in display mode while editing in a centered glass dialog panel. */
export function ProfileEditModal({
  open,
  profile,
  saving,
  focusBio = false,
  onCancel,
  onSave,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Track the element that had focus before the modal opened.
  useEffect(() => {
    if (open && document.activeElement) {
      openerRef.current = document.activeElement as HTMLElement
    }
  }, [open])

  // Mount portal content on open and trigger entrance animation.
  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => setAnimate(true))
    }
    return () => {
      setMounted(false)
      setAnimate(false)
    }
  }, [open])

  // Lock body scroll and trap Escape key.
  useEffect(() => {
    if (!open) return

    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      if (openerRef.current) {
        openerRef.current.focus()
        openerRef.current = null
      }
    }
  }, [open, onCancel])

  // Focus trap inside the modal dialog panel.
  useEffect(() => {
    if (!open || !dialogRef.current) return
    const panel = dialogRef.current
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last || document.activeElement === panel) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    panel.addEventListener('keydown', handleTab)
    return () => panel.removeEventListener('keydown', handleTab)
  }, [open])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Scrim: full-screen backdrop. Clicking the scrim does NOT close the modal to prevent accidental data loss. */}
      <div className={`dialog-scrim${animate ? ' dialog-scrim-in' : ''}`} />

      {/* Glass dialog panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-modal-title"
        className={`dialog-panel w-[min(640px,calc(100vw-48px))] max-h-[calc(100dvh-64px)] flex flex-col p-0 overflow-hidden rounded-card ${
          animate ? 'dialog-in' : ''
        }`}
      >
        <span aria-hidden="true" className="dialog-accent-line" />

        {/* Header */}
        <div className="border-b border-border px-5 py-4 sm:px-6 shrink-0">
          <h2
            id="profile-edit-modal-title"
            className="text-[22px] font-display font-semibold tracking-tight text-fg"
          >
            Edit personal details
          </h2>
        </div>

        {/* Body & Footer */}
        <ProfileEditFields
          profile={profile}
          saving={saving}
          focusBio={focusBio}
          onCancel={onCancel}
          onSave={onSave}
          mode="modal"
        />
      </div>
    </div>,
    document.body
  )
}
