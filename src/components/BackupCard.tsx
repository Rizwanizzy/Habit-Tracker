import { useEffect, useRef, useState } from 'react'
import { useBackup } from '../hooks/useBackup'
import { useImportBackup, type ImportOptions } from '../hooks/useImportBackup'
import { ImportPreviewDialog } from './ImportPreviewDialog'
import { IconDownload, IconUpload } from './icons'

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
    <div
      className="@container glass-card fade-up order-2 min-w-0 rounded-card px-3 py-4 lg:order-none lg:p-6"
      style={{ animationDelay: '80ms' }}
    >
      <h2 className="text-section-title">Data</h2>
      <p className="mt-1 text-body text-fg-secondary max-lg:hidden">
        Export or import a JSON backup of your habits and check-ins. Profile photos aren&apos;t included.
      </p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 max-lg:hidden lg:mt-4">
        <input
          type="checkbox"
          checked={includeProfile}
          onChange={(e) => setIncludeProfile(e.target.checked)}
          className="size-5 shrink-0 accent-accent"
        />
        <span className="text-[13px] text-fg lg:text-body">
          Include profile<span className="max-lg:hidden"> details</span>
        </span>
      </label>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="mt-3 inline-flex items-center justify-center gap-2.5 rounded-pill bg-accent px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60 max-lg:hidden"
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
      <div className="mt-3 max-lg:hidden">
        <label
          htmlFor="import-backup-file"
          className={`mt-1 inline-flex h-11 cursor-pointer items-center justify-center rounded-pill border border-success/35 bg-success/15 px-5 text-body font-semibold text-success transition-all duration-150 hover:bg-success/25 active:scale-95 ${
            importing ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          Import backup
        </label>
      </div>

      {/* Phone (below lg): compact — the checkbox row first (36px visual,
          padded to a 44px hit area without covering what follows), then two
          REAL pills (icon BESIDE a one-word 12px label, 40px high, fully
          rounded). The card is a size container (@container): below 166px of
          card inline-size both halves cannot fit their text (measured:
          "Export"/"Import" ≈ 35/34px at 12px + 26px chrome = 61px/pill →
          2×61 + 6 gap = 142px inner + 24px padding = 166px card), so the row
          collapses to two full-width STACKED pills (8px gap, 13px labels).
          The ::after pads stretch each 40px pill to a 44px tap area
          vertically only, so neighbours in the 6px grid gap stay tappable.
          Busy swaps the icon for the spinner and keeps the one-word label —
          "Exporting…" would need ~77px per pill and would clip the halves
          (desktop keeps its "Exporting…" wording). Same handlers/state;
          accessible names stay "Export backup" / "Import backup". */}
      <div className="mt-3 flex flex-col gap-2 lg:hidden">
        <label className="relative flex min-h-9 cursor-pointer items-center gap-3 after:absolute after:-inset-1 after:content-['']">
          <input
            type="checkbox"
            checked={includeProfile}
            onChange={(e) => setIncludeProfile(e.target.checked)}
            className="size-5 shrink-0 accent-accent"
          />
          <span className="min-w-0 text-[13px] text-fg">Include profile</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5 @max-[166px]:grid-cols-1 @max-[166px]:gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            aria-label="Export backup"
            className="relative inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-full bg-accent px-1 font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']"
          >
            {exporting ? (
              <span aria-hidden="true" className="progress-spin size-3.5 rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <IconDownload className="size-3.5" />
            )}
            <span className="min-w-0 whitespace-nowrap text-[12px] @max-[166px]:text-[13px]">Export</span>
          </button>
          <label
            htmlFor="import-backup-file"
            aria-label="Import backup"
            className={`relative inline-flex h-10 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-success/35 bg-success/15 px-1 font-semibold text-success transition-all duration-150 hover:bg-success/25 active:scale-95 focus-within:ring-2 focus-within:ring-accent after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
              importing ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <IconUpload className="size-3.5" />
            <span className="min-w-0 whitespace-nowrap text-[12px] @max-[166px]:text-[13px]">Import</span>
          </label>
        </div>
      </div>

      <div>
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
