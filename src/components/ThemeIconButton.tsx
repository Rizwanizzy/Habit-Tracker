import { useTheme } from '../hooks/useTheme'
import { IconMoon, IconSun } from './icons'

interface Props {
  /** Disabled while reorder (jiggle) mode is active, like other Today controls. */
  disabled?: boolean
  className?: string
}

/** Theme icon button for the Today header: one compact circular glass icon
 *  showing the theme you'd switch TO — sun in dark mode, moon in light mode —
 *  with a rotate + cross-fade swap (CSS only, honors reduced motion). */
export function ThemeIconButton({ disabled = false, className = '' }: Props) {
  const { dark, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-raised text-fg-secondary transition-colors duration-150 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
        className || 'size-11 lg:size-13'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute grid place-items-center transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
          dark ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0'
        }`}
      >
        <IconSun className="size-6" />
      </span>
      <span
        aria-hidden="true"
        className={`absolute grid place-items-center transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
          dark ? '-rotate-90 opacity-0' : 'rotate-0 opacity-100'
        }`}
      >
        <IconMoon className="size-6" />
      </span>
    </button>
  )
}
