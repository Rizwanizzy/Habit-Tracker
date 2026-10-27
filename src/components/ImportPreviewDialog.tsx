import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import type { ImportOptions, ImportPreview, ImportProgress } from '../hooks/useImportBackup'

interface Props {
  preview: ImportPreview
  options: ImportOptions
  onOptions: (patch: Partial<ImportOptions>) => void
  onImport: () => void
  onClose: () => void
  /** Any import possible at all (new habits/entries or an option selected). */
  importable: boolean
  busy: boolean
  progress: ImportProgress | null
  error: string | null
}

const nf = new Intl.NumberFormat()

function Roll({ checked, label, hint, disabled, onChange }: {
  checked: boolean
  label: string
  hint?: string
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={`flex min-h-11 items-center gap-3 py-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-accent"
      />
      <span className="min-w-0">
        <span className="text-body block text-fg">{label}</span>
        {hint && <span className="text-caption mt-0.5 block text-fg-muted">{hint}</span>}
      </span>
    </label>
  )
}

/** Import preview dialog (DESIGN.md §13): the backup's plan — file name,
 *  export context, what is new vs already in the app, date range, warnings
 *  and the option checkboxes — before anything is written. Portal-rendered
 *  glass panel (ConfirmDialog pattern): Escape cancels, focus trap, scroll
 *  lock, focus returns to the opener. Import is disabled (with a friendly
 *  notice) when everything in the file is already in the app. */
export function ImportPreviewDialog({
  preview,
  options,
  onOptions,
  onImport,
  onClose,
  importable,
  busy,
  progress,
  error,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      openerRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  // Focus trap.
  useEffect(() => {
    const panel = dialogRef.current
    if (!panel) return
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
      } else if (document.activeElement === last || document.activeElement === panel) {
        e.preventDefault()
        first?.focus()
      }
    }
    panel.addEventListener('keydown', handleTab)
    return () => panel.removeEventListener('keydown', handleTab)
  }, [])

  const { counts, firstDate, lastDate } = preview.plan

  const exportDate =
    preview.backup.exportedAt !== ''
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(preview.backup.exportedAt),
        )
      : undefined

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={!busy ? onClose : undefined}>
      <div className="dialog-scrim" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="dialog-panel dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden="true" className="dialog-accent-line" />
        <h2 id="import-dialog-title" className="mt-1 text-page-title">
          Import backup
        </h2>
        <p className="mt-1 min-w-0 truncate text-caption text-fg-muted" title={preview.fileName}>
          {preview.fileName}
          {exportDate ? ` · exported ${exportDate}` : ''}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-input border border-border bg-surface px-3 py-2">
            <dt className="text-caption text-fg-muted">Habits</dt>
            <dd className="text-body tabular-nums text-fg">
              {counts.habitsNew} new · {counts.habitsExisting} existing
            </dd>
          </div>
          <div className="rounded-input border border-border bg-surface px-3 py-2">
            <dt className="text-caption text-fg-muted">Entries</dt>
            <dd className="text-body tabular-nums text-fg">
              {nf.format(counts.entriesNew)} new · {nf.format(counts.entriesExisting)} existing
            </dd>
          </div>
          {preview.backup.vacationPeriods.length > 0 && (
            <div className="col-span-2 rounded-input border border-border bg-surface px-3 py-2">
              <dt className="text-caption text-fg-muted">Breaks (vacation)</dt>
              <dd className="text-body tabular-nums text-fg">
                {counts.vacationsNew} new · {counts.vacationsExisting} existing
              </dd>
            </div>
          )}
          {firstDate && lastDate && (
            <div className="col-span-2 rounded-input border border-border bg-surface px-3 py-2">
              <dt className="text-caption text-fg-muted">Entry range</dt>
              <dd className="text-body tabular-nums text-fg">
                {firstDate} → {lastDate}
              </dd>
            </div>
          )}
        </dl>

        {preview.plan.warnings.length > 0 && (
          <ul className="mt-3 rounded-input bg-surface px-3 py-2" role="note">
            {preview.plan.warnings.map((w, i) => (
              <li key={i} className="text-caption text-fg-secondary">
                {w}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <Roll
            checked={options.overwrite}
            label="Overwrite with the backup"
            hint="Default off: keep what's already in the app; importing twice changes nothing."
            disabled={busy}
            onChange={(v) => onOptions({ overwrite: v })}
          />
          <Roll
            checked={options.restoreSettings}
            label="Restore settings"
            hint="Day-start hour from the file."
            disabled={busy || !preview.plan.hasSettings}
            onChange={(v) => onOptions({ restoreSettings: v })}
          />
          {preview.plan.hasProfile && (
            <Roll
              checked={options.restoreProfile}
              label="Restore profile details"
              hint="Name, birthday etc. — never the photo or email."
              disabled={busy}
              onChange={(v) => onOptions({ restoreProfile: v })}
            />
          )}
        </div>

        {!importable && !busy && (
          <p className="text-body mt-3 rounded-input bg-surface px-3 py-2 text-fg-muted">
            Nothing to import: everything in this file is already in your app.
          </p>
        )}
        {error && (
          <p role="alert" className="text-body mt-3 rounded-input bg-danger/10 px-3 py-2 text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            ref={cancelRef}
            onClick={onClose}
            disabled={busy}
            className="w-full sm:w-auto h-12 rounded-pill px-4 text-body font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-raised active:scale-95 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={busy || !importable}
            className="inline-flex w-full items-center justify-center gap-2.5 sm:w-auto h-12 rounded-pill bg-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            {busy && progress && (
              <span
                aria-hidden="true"
                className="progress-spin size-4 shrink-0 rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {busy
              ? progress
                ? progress.phase === 'habits'
                  ? 'Creating habits…'
                  : progress.phase === 'vacations'
                    ? 'Restoring breaks…'
                    : `${nf.format(progress.done)} / ${nf.format(progress.total)} entries`
                : 'Importing…'
              : 'Import'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
