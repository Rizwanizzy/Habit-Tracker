import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VALID_THEMES,
  applyTheme,
  getStoredTheme,
  getThemeMetaColor,
  isDarkTheme,
  isTheme,
  resolveTheme,
} from './useTheme'

describe('useTheme core logic', () => {
  let storage: Record<string, string> = {}
  let rootAttributes: Record<string, string> = {}
  let rootClasses: Set<string> = new Set()

  beforeEach(() => {
    storage = {}
    rootAttributes = {}
    rootClasses = new Set()

    const mockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = String(val)
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
      clear: () => {
        storage = {}
      },
    }

    const mockElement = {
      classList: {
        contains: (c: string) => rootClasses.has(c),
        add: (c: string) => rootClasses.add(c),
        remove: (c: string) => rootClasses.delete(c),
        toggle: (c: string, force?: boolean) => {
          if (force === true) rootClasses.add(c)
          else if (force === false) rootClasses.delete(c)
          else if (rootClasses.has(c)) rootClasses.delete(c)
          else rootClasses.add(c)
        },
      },
      setAttribute: (k: string, v: string) => {
        rootAttributes[k] = v
      },
      getAttribute: (k: string) => rootAttributes[k] ?? null,
      removeAttribute: (k: string) => {
        delete rootAttributes[k]
      },
      style: { colorScheme: '' },
    }

    vi.stubGlobal('localStorage', mockStorage)
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      localStorage: mockStorage,
    })
    vi.stubGlobal('document', {
      documentElement: mockElement,
      querySelector: vi.fn().mockReturnValue(null),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('validates theme names correctly', () => {
    for (const t of VALID_THEMES) {
      expect(isTheme(t)).toBe(true)
    }
    expect(isTheme('random-theme')).toBe(false)
    expect(isTheme('')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('resolves system theme based on prefers-color-scheme', () => {
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('resolves solarized theme based on prefers-color-scheme', () => {
    expect(resolveTheme('solarized', false)).toBe('solarized-light')
    expect(resolveTheme('solarized', true)).toBe('solarized-dark')
  })

  it('resolves static themes directly', () => {
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('sepia', false)).toBe('sepia')
    expect(resolveTheme('oled', false)).toBe('oled')
    expect(resolveTheme('high-contrast', false)).toBe('high-contrast')
  })

  it('classifies dark vs light themes', () => {
    expect(isDarkTheme('dark')).toBe(true)
    expect(isDarkTheme('oled')).toBe(true)
    expect(isDarkTheme('solarized-dark')).toBe(true)
    expect(isDarkTheme('high-contrast')).toBe(true)
    expect(isDarkTheme('light')).toBe(false)
    expect(isDarkTheme('sepia')).toBe(false)
    expect(isDarkTheme('solarized-light')).toBe(false)
  })

  it('provides theme meta colors for all resolved themes', () => {
    expect(getThemeMetaColor('light').toLowerCase()).toBe('#e6eef8')
    expect(getThemeMetaColor('dark').toLowerCase()).toBe('#070a12')
    expect(getThemeMetaColor('sepia').toLowerCase()).toBe('#f5eee6')
    expect(getThemeMetaColor('oled').toLowerCase()).toBe('#000000')
    expect(getThemeMetaColor('solarized-light').toLowerCase()).toBe('#fdf6e3')
    expect(getThemeMetaColor('solarized-dark').toLowerCase()).toBe('#002b36')
    expect(getThemeMetaColor('high-contrast').toLowerCase()).toBe('#000000')
  })

  it('reads stored theme from localStorage with fallback for invalid or legacy data', () => {
    expect(getStoredTheme()).toBe('system')

    localStorage.setItem('theme', 'sepia')
    expect(getStoredTheme()).toBe('sepia')

    localStorage.setItem('theme', 'oled')
    expect(getStoredTheme()).toBe('oled')

    localStorage.setItem('theme', 'unknown-val')
    expect(getStoredTheme()).toBe('system')
  })

  it('applies theme attributes to the DOM', () => {
    applyTheme('sepia')
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
    expect(document.documentElement.getAttribute('data-selected-theme')).toBe('sepia')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    applyTheme('oled')
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled')
    expect(document.documentElement.getAttribute('data-selected-theme')).toBe('oled')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    applyTheme('high-contrast')
    expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
