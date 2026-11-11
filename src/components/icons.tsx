import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconToday({ className }: { className?: string }) {
  return <IconHome className={className} />
}

export function IconOverview({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      {/* Outer rounded document sheet */}
      <rect x="4" y="2.5" width="16" height="19" rx="3" />
      {/* Top title header notch */}
      <path d="M8.5 6.5h7" />
      {/* 3 report item rows: horizontal bar on left, bullet status dot on right */}
      <path d="M8 10.5h5" />
      <circle cx="16" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <path d="M8 14.5h5" />
      <circle cx="16" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
      <path d="M8 18.5h5" />
      <circle cx="16" cy="18.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      {/* Center circle axle hub */}
      <circle cx="12" cy="12" r="3" />
      {/* Precision 8-tooth circular gear wheel rim */}
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconSun({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

export function IconMoon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

export function IconLogout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function IconFlame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M12 22c4.42 0 8-3.58 8-8 0-5-4-7-5-9-1.5 2-2 3.5-2 5 0 .5.5 2-1 2-1 0-1.5-1-1.5-2.5C8.5 11 4 13 4 17a7 7 0 0 0 6.66 7" />
    </svg>
  )
}

export function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </svg>
  )
}

/** Smiley with a small plus at the corner — "add an emoji" placeholder on
 *  the phone form's circle trigger. */
export function IconSmileyPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="10.5" cy="12.5" r="6.5" />
      <circle cx="8.5" cy="11" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="11" r="0.5" fill="currentColor" stroke="none" />
      <path d="M8 14c.6.8 1.5 1.3 2.5 1.3s1.9-.5 2.5-1.3" />
      <path d="M18.5 2.5v5" />
      <path d="M16 5h5" />
    </svg>
  )
}

export function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconMore({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSkip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="m5 4 10 8-10 8V4z" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  )
}

export function IconPencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

export function IconUser({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.7 18.6a6.5 6.5 0 0 1 10.6 0" />
    </svg>
  )
}

export function IconCamera({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h2.2l1.2-1.6a2 2 0 0 1 1.6-.8h4a2 2 0 0 1 1.6.8L16.8 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  )
}

export function IconLock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="5.5" y="11" width="13" height="9" rx="2.5" />
      <path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
    </svg>
  )
}

export function IconPalette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.12a1.64 1.64 0 0 1 1.68-1.69h1.96C19.76 16.37 22 13.69 22 10.37 22 4.5 17.6 2 12 2Z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </svg>
  )
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

/** Home icon (DESIGN.md §5: Today / Home navigation glyph).
 *  Matches the architectural house model: pitched roof with eaves overhang,
 *  right-side roof chimney, arched doorway, door handle, and solid baseline. */
export function IconHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      {/* Chimney on the right roof slope */}
      <path d="M17 7.5V4h2.5v5.5" />
      {/* Pitched roof with eaves overhang */}
      <path d="m2 11.5 10-8 10 8" />
      {/* House body walls and base */}
      <path d="M4.5 10.5V21h15V10.5" />
      {/* Arched doorway in center */}
      <path d="M9 21v-6a3 3 0 0 1 6 0v6" />
      {/* Vertical door handle */}
      <path d="M13.5 16v-2.5" />
    </svg>
  )
}

/** Calendar glyph for date fields (VacationCard's custom date buttons). */
export function IconCalendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 11h18" />
    </svg>
  )
}

/* --- Settings — Data card pills and habit manage tiles (phone layout) --- */

/** Arrow down to a baseline — "Export backup" pill. */
export function IconDownload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M12 4v11" />
      <path d="m7 10.5 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  )
}

/** Arrow up from a baseline — "Import backup" pill. */
export function IconUpload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M12 19V8" />
      <path d="m7 12.5 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  )
}

/** Storage box with an arrow going down into it — archive (Settings phone
 *  tiles). Thinner 1.8 stroke so the box detail stays legible at 20px. */
export function IconArchive({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
      <path d="M12 11.5v5" />
      <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
    </svg>
  )
}

/** Storage box with an arrow coming up out of it — unarchive (Settings
 *  phone tiles), the mirror of IconArchive at the same 1.8 stroke. */
export function IconUnarchive({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
      <path d="M12 16.5v-5" />
      <path d="m9.5 9.5 2.5-2.5 2.5 2.5" />
    </svg>
  )
}

export function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function IconBell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

/** Performance Review icon: 3 rising rounded bar columns with an upward climbing
 *  trendline and arrowhead (growth, progress analysis, retrospective performance). */
export function IconReview({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      {/* 3 rising vertical pill bars */}
      <rect x="3.5" y="16.5" width="3.2" height="4.5" rx="1.6" />
      <rect x="10.4" y="13" width="3.2" height="8" rx="1.6" />
      <rect x="17.3" y="9.5" width="3.2" height="11.5" rx="1.6" />
      {/* Ascending zigzag trendline */}
      <path d="M3.5 10.5 8.5 6.5l4 3 8-6.5" />
      {/* Upward-pointing arrowhead */}
      <path d="M16 3h4.5v4.5" />
    </svg>
  )
}

export function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

export function IconTrendingDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  )
}

export function IconSparkles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  )
}