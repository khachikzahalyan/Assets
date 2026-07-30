import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'ams-theme'

interface ThemeApi {
  theme: Theme
  toggleTheme: () => void
}

/** Read the boot theme — index.html's inline script already applied the class
 *  before first paint, so the DOM class is the source of truth on mount. */
function initialTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) {
    return 'light'
  }
  return 'dark'
}

const Ctx = createContext<ThemeApi>({ theme: 'dark', toggleTheme: () => {} })

export function useTheme(): ThemeApi { return useContext(Ctx) }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('light', next === 'light')
      // Keep the browser chrome color in sync (mobile address bar)
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', next === 'light' ? '#FFFFFF' : '#111315')
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch { /* storage unavailable — theme applies for this session only */ }
      return next
    })
  }, [])

  return <Ctx.Provider value={{ theme, toggleTheme }}>{children}</Ctx.Provider>
}
