import { useCallback, useMemo, useState } from 'react'
import { readJSON, writeJSON } from '../services/storage'
import { DEFAULT_THEME, isValidTheme } from './themes'
import ThemeContext from './themeContextObject'

const STORAGE_KEY = 'student_theme'

function getStoredTheme(storageKey, defaultTheme) {
  const stored = readJSON(storageKey, defaultTheme)
  return isValidTheme(stored) ? stored : defaultTheme
}

// fixedTheme: panelin kendi seçilebilir stil paleti yoksa (bkz. TeacherApp) kullanılır.
// Kayıtlı/önceki bir tercihi yok sayar ve setTheme'i no-op yapar; PanelHeader da bu panel
// için "Stil" değiştiriciyi zaten göstermez, ama context yine de tüm alt bileşenlerin
// data-theme'e bağlı CSS token'larını (panel-blue, student-theme-* vb.) alabilmesi için sağlanır.
export default function ThemeProvider({ children, storageKey = STORAGE_KEY, defaultTheme = DEFAULT_THEME, fixedTheme }) {
  const [theme, setThemeState] = useState(() => fixedTheme || getStoredTheme(storageKey, defaultTheme))

  const setTheme = useCallback((nextTheme) => {
    if (fixedTheme) return
    if (!isValidTheme(nextTheme)) return
    setThemeState(nextTheme)
    writeJSON(storageKey, nextTheme)
  }, [storageKey, fixedTheme])

  const value = useMemo(() => ({ theme, setTheme, locked: Boolean(fixedTheme) }), [theme, setTheme, fixedTheme])

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={theme} className="min-h-screen">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
