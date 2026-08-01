import { useCallback, useMemo, useState } from 'react'
import { readJSON, writeJSON } from '../services/storage'
import { DEFAULT_THEME, isValidTheme } from './themes'
import ThemeContext from './themeContextObject'

const STORAGE_KEY = 'student_theme'

function getStoredTheme() {
  const stored = readJSON(STORAGE_KEY, DEFAULT_THEME)
  return isValidTheme(stored) ? stored : DEFAULT_THEME
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme)

  const setTheme = useCallback((nextTheme) => {
    if (!isValidTheme(nextTheme)) return
    setThemeState(nextTheme)
    writeJSON(STORAGE_KEY, nextTheme)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={theme} className="min-h-screen">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
