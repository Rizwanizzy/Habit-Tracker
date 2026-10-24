import { useTheme } from '../hooks/useTheme'
import { IconMoon, IconSun } from './icons'

/** Theme switch (DESIGN.md §8): sliding accent knob; the two icons swap with
 *  a rotate + cross-fade animation (CSS only, honors reduced motion). */
export function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggle}
        className="relative h-11 w-[92px] rounded-pill border border-border bg-surface-raised p-0.5"
      >
        <span
          aria-hidden="true"
          className={`bg-accent-gradient glow-accent absolute inset-y-0.5 left-0.5 w-[42px] rounded-pill transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
            dark ? 'translate-x-[44px]' : 'translate-x-0'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-[8px] grid w-[34px] place-items-center transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
            dark ? 'scale-50 -rotate-90 opacity-0' : 'text-white'
          }`}
        >
          <IconSun className="size-5" />
        </span>
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 right-[8px] grid w-[34px] place-items-center transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
            dark ? 'text-white' : 'scale-50 rotate-90 opacity-0'
          }`}
        >
          <IconMoon className="size-5" />
        </span>
      </button>
      <p className="text-body text-fg-secondary">{dark ? 'Dark' : 'Light'} theme</p>
    </div>
  )
}
