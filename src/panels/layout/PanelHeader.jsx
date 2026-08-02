import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, LogOut, RefreshCw, Undo2, Users } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { authRequest } from '../../services/authClient'
import ThemeContext from '../../theme/themeContextObject'
import { THEMES } from '../../theme/themes'

export default function PanelHeader() {
  const { authUser, logout, enterStudent, returnToParent } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [students, setStudents] = useState(null)
  const [switching, setSwitching] = useState(false)
  const menuRef = useRef(null)
  const themeMenuRef = useRef(null)
  const initial = authUser?.fullName?.trim()?.[0]?.toUpperCase() || '?'
  const isParent = authUser?.role === 'ebeveyn'
  const actingParent = authUser?.actingParent
  const themeCtx = useContext(ThemeContext)
  const activeTheme = themeCtx ? THEMES.find((theme) => theme.id === themeCtx.theme) || THEMES[0] : null

  useEffect(() => {
    if (!open && !themeOpen) return undefined

    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setThemeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, themeOpen])

  useEffect(() => {
    if (!open || !isParent || students !== null) return

    authRequest('/api/parent/students', { method: 'GET' })
      .then((data) => setStudents(data.students))
      .catch(() => setStudents([]))
  }, [open, isParent, students])

  const handleEnterStudent = async (studentId) => {
    setSwitching(true)
    try {
      await enterStudent(studentId)
      setOpen(false)
      navigate('/student/today')
    } catch {
      // authRequest already surfaces network/session errors elsewhere; keep the menu open on failure
    } finally {
      setSwitching(false)
    }
  }

  const handleReturnToParent = async () => {
    setSwitching(true)
    try {
      await returnToParent()
      setOpen(false)
      navigate('/parent/dashboard')
    } catch {
      // no-op: session stays as-is if the call fails
    } finally {
      setSwitching(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-panel-border bg-panel-surface px-4 md:px-6">
      {actingParent ? (
        <button
          type="button"
          onClick={handleReturnToParent}
          disabled={switching}
          className="flex items-center gap-1.5 rounded-lg bg-student-theme-soft px-2.5 py-1 text-xs font-medium text-student-theme-text hover:opacity-80 disabled:opacity-60"
        >
          <Undo2 size={13} aria-hidden="true" />
          {actingParent.fullName} olarak devam ediyorsunuz · Ebeveyn Paneline Dön
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => window.location.reload()}
        aria-label="Sayfayı yenile"
        title="Sayfayı yenile"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
      >
        <RefreshCw size={16} aria-hidden="true" />
      </button>

      {themeCtx ? (
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => {
              setThemeOpen((value) => !value)
              setOpen(false)
            }}
            aria-haspopup="true"
            aria-expanded={themeOpen}
            aria-label="Tema seç"
            className="flex h-9 items-center gap-2 rounded-full border border-panel-border bg-panel-surface px-2.5 text-sm font-semibold text-panel-text shadow-sm hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
          >
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: activeTheme?.swatches[2] }}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Tema</span>
            <ChevronDown size={14} className="hidden shrink-0 sm:block" aria-hidden="true" />
          </button>

          {themeOpen ? (
            <div className="absolute right-0 top-12 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-panel-border bg-panel-surface p-2 shadow-panel-2">
              <div className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-panel-text-muted">
                Tema Seç
              </div>
              <div className="grid gap-1">
                {THEMES.map((option) => {
                  const isActive = option.id === themeCtx.theme
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        themeCtx.setTheme(option.id)
                        setThemeOpen(false)
                      }}
                      aria-pressed={isActive}
                      className={`flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'bg-student-theme-primary text-student-theme-button-text'
                          : 'text-panel-text hover:bg-panel-surface-soft'
                      }`}
                    >
                      <span className="mt-0.5 flex shrink-0 -space-x-1.5" aria-hidden="true">
                        {option.swatches.slice(0, 3).map((swatch) => (
                          <span
                            key={swatch}
                            className="h-5 w-5 rounded-full border border-panel-surface"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">{option.label}</span>
                        <span className={`mt-0.5 block text-xs leading-snug ${isActive ? 'text-student-theme-button-text/80' : 'text-panel-text-muted'}`}>
                          {option.description}
                        </span>
                      </span>
                      {isActive ? <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value)
            setThemeOpen(false)
          }}
          aria-haspopup="true"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-panel-surface-soft"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-student-theme-soft text-xs font-semibold text-student-theme-text">
            {initial}
          </div>
          <span className="hidden text-sm font-medium text-panel-text sm:inline">
            {authUser?.fullName?.split(' ')[0]}
          </span>
          <ChevronDown size={14} className="hidden shrink-0 text-panel-text-muted sm:block" aria-hidden="true" />
        </button>

        {open ? (
          <div className="absolute right-0 top-12 z-50 min-w-[220px] rounded-xl border border-panel-border bg-panel-surface py-1 shadow-panel-2">
            {isParent ? (
              <>
                <div className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-panel-text-muted">
                  Öğrenci Paneline Geç
                </div>
                {students === null ? (
                  <div className="px-4 py-2 text-sm text-panel-text-muted">Yükleniyor...</div>
                ) : students.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-panel-text-muted">Bağlı öğrenci yok.</div>
                ) : (
                  students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      disabled={switching}
                      onClick={() => handleEnterStudent(student.id)}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                    >
                      <Users size={15} className="text-panel-text-muted" aria-hidden="true" />
                      {student.fullName}
                    </button>
                  ))
                )}
                <div className="my-1 border-t border-panel-border" />
              </>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                logout().catch(() => {})
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-panel-text hover:bg-panel-surface-soft"
            >
              <LogOut size={16} className="text-panel-text-muted" aria-hidden="true" />
              Çıkış Yap
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
