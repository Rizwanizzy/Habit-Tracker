import { useEffect, useRef, useState } from 'react'
import { useBackup } from '../hooks/useBackup'
import { useImportBackup, type ImportOptions } from '../hooks/useImportBackup'
import { ImportPreviewDialog } from './ImportPreviewDialog'

type Notice = { kind: 'success' | 'danger'; text: string } | null

/** Settings "Data" card (DESIGN.md §8): JSON backup export (paged past
 *  Supabase's 1000-row cap, archived habits included) and the ADDITIVE
 *  import — file picker → glass preview dialog (plan + options) → chunked
 *  upserts. Toasts follow the Profile-page fixed glass-pill pattern. */
export function BackupCard() {
  const { exportBackup, busy: exporting } = useBackup()
  const { preview, readFile, run, closePreview, busy: importing, progress, error: importError } = useImportBackup()
  const [includeProfile, setIncludeProfile] = useState(false)
  const [options, setOptions] = useState<ImportOptions>({
    overwrite: false,
    restoreSettings: false,
    restoreProfile: false,
  })
  const [notice, setNotice] = useState<Notice>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-dismiss toasts, same as Profile/Today.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  // New option defaults when the preview arrives (settings restore defaults
  // ON only when the user has no user_settings row yet).
  useEffect(() => {
    if (preview) {
      setOptions((o) => ({
        ...o,
        restoreSettings: preview.plan.hasSettings && !preview.hasSettingsRow,
        restoreProfile: false,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.fileName, preview?.plan])

  async function handleExport() {
    const message = await exportBackup(includeProfile)
    if (message) setNotice({ kind: 'danger', text: message })
    else setNotice({ kind: 'success', text: 'Backup exported' })
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    const message = await readFile(file)
    // parse errors are state + returned; a null here means the preview is open.
    if (message) setNotice({ kind: 'danger', text: message })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleImport() {
    if (!preview) return
    const result = await run(preview, options)
    if (result) {
      const parts: string[] = []
      if (result.habitsCreated > 0) parts.push(`${result.habitsCreated} habit${result.habitsCreated === 1 ? '' : 's'}`)
      if (result.entriesAdded > 0) parts.push(`${result.entriesAdded} entries`)
      if (result.vacationsAdded > 0)
        parts.push(`${result.vacationsAdded} break${result.vacationsAdded === 1 ? '' : 's'}`)
      setNotice({ kind: 'success', text: parts.length > 0 ? `Imported ${parts.join(' · ')}` : 'Nothing needed importing' })
      closePreview()
    }
    // A failure keeps the dialog open: the error state (shown in the dialog)
    // reports exactly what was imported and reassures re-running is safe.
  }

  const anythingToImport =
    preview != null &&
    (preview.plan.counts.habitsNew > 0 ||
      preview.plan.counts.entriesNew > 0 ||
      preview.plan.counts.vacationsNew > 0 ||
      options.restoreSettings ||
      options.restoreProfile)

  return (
    <div className="glass-card fade-up rounded-card p-6" style={{ animationDelay: '80ms' }}>
      <h2 className="text-section-title">Data</h2>
      <p className="mt-1 text-body text-fg-secondary">
        Export or import a JSON backup of your habits and check-ins. Profile photos aren&apos;t included.
      </p>
      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={includeProfile}
          onChange={(e) => setIncludeProfile(e.target.checked)}
          className="size-5 shrink-0 accent-accent"
        />
        <span className="text-body text-fg">Include profile details</span>
      </label>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="mt-3 inline-flex items-center justify-center gap-2.5 rounded-pill bg-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60"
        style={{ height: 44 }}
      >
        {exporting && (
          <span
            aria-hidden="true"
            className="progress-spin size-4 rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {exporting ? 'Exporting…' : 'Export backup'}
      </button>
      <div className="mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void handleFile(e.target.files?.[0])}
          className="sr-only"
          id="import-backup-file"
          aria-hidden="true"
          tabIndex={-1}
        />
        <label
          htmlFor="import-backup-file"
          className={`mt-1 inline-flex h-11 cursor-pointer items-center justify-center rounded-pill border border-success/35 bg-success/15 px-5 text-body font-semibold text-success transition-all duration-150 hover:bg-success/25 active:scale-95 ${
            importing ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          Import backup
        </label>
      </div>

      {preview && (
        <ImportPreviewDialog
          preview={preview}
          options={options}
          onOptions={(patch) => setOptions((o) => ({ ...o, ...patch }))}
          onImport={() => void handleImport()}
          onClose={closePreview}
          importable={anythingToImport}
          busy={importing}
          progress={progress}
          error={importError}
        />
      )}

      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center lg:bottom-6"
        >
          <p
            className={`glass-pill rounded-pill px-5 py-2.5 text-body font-medium ${
              notice.kind === 'success' ? 'text-success' : 'text-danger'
            }`}
          >
            {notice.text}
          </p>
        </div>
      )}
    </div>
  )
}
