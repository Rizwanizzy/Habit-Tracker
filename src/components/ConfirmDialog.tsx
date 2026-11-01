import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  onConfirm: () => void
  danger?: boolean
}

/** ConfirmDialog (DESIGN.md §13): a shared, portal-rendered confirmation
 *  dialog. The scrim and panel render into document.body so no parent with
 *  backdrop-filter/transform/overflow can break the blur. Glass panel, not
 *  solid. Keyboard accessible: Escape cancels, focus moves to Cancel on open,
 *  focus trap inside, focus returns to opener on close. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  danger = false,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Track the element that had focus before the dialog opened.
  useEffect(() => {
    if (open && document.activeElement) {
      openerRef.current = document.activeElement as HTMLElement
    }
  }, [open])

  // Mount portal content on open so createPortal target exists, then trigger entry animation.
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

  // Open: focus Cancel, lock body scroll, trap Escape.
  // Close: restore focus, unlock body scroll.
  useEffect(() => {
    if (!open) return
    if (cancelRef.current) cancelRef.current.focus()

    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
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
  }, [open, onClose])

  // Focus trap: keep focus inside the dialog panel.
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
    <>
      {/* Scrim wrapper: fixed, full-screen, centers its children */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        {/* Scrim: full-screen layer behind the dialog */}
        <div className={`dialog-scrim${animate ? ' dialog-scrim-in' : ''}`} />

        {/* Dialog panel: glass, compact, centered */}
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-desc"
          className={`dialog-panel${animate ? ' dialog-in' : ''}${danger ? ' danger' : ''}`}
        >
          {/* Top accent line */}
          <span
            aria-hidden="true"
            className={`dialog-accent-line${danger ? ' danger' : ''}`}
          />
          <h2 id="confirm-dialog-title" className="mt-1 text-page-title">
            {title}
          </h2>
          <p id="confirm-dialog-desc" className="mt-2 text-body text-fg-secondary leading-relaxed">
            {description}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              ref={cancelRef}
              onClick={onClose}
              className="w-full sm:w-auto h-12 rounded-pill px-4 text-body font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-raised active:scale-95"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onConfirm()
              }}
              className={`w-full sm:w-auto h-12 rounded-pill px-5 text-body font-medium transition-colors duration-150 active:scale-95 ${
                danger
                  ? 'bg-danger/10 border border-danger text-danger hover:bg-danger/20'
                  : 'bg-surface-raised text-fg hover:bg-surface'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
