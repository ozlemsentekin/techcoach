import { useCallback, useMemo, useState } from 'react'
import { readJSON, writeJSON } from '../services/storage'
import { DEFAULT_THEME, isValidTheme } from './themes'
import ThemeContext from './themeContextObject'

const STORAGE_KEY = 'student_theme'

function getStoredTheme(storageKey, defaultTheme) {
  const stored = readJSON(storageKey, defaultTheme)
  return isValidTheme(stored) ? stored : defaultTheme
}

export default function ThemeProvider({ children, storageKey = STORAGE_KEY, defaultTheme = DEFAULT_THEME }) {
  const [theme, setThemeState] = useState(() => getStoredTheme(storageKey, defaultTheme))

  const setTheme = useCallback((nextTheme) => {
    if (!isValidTheme(nextTheme)) return
    setThemeState(nextTheme)
    writeJSON(storageKey, nextTheme)
  }, [storageKey])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={theme} className="min-h-screen">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
