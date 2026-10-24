import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconToday({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

export function IconOverview({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}

export function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
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

export function IconPencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}