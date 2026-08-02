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
  const [students, setStudents] = useState(null)
  const [switching, setSwitching] = useState(false)
  const menuRef = useRef(null)
  const initial = authUser?.fullName?.trim()?.[0]?.toUpperCase() || '?'
  const isParent = authUser?.role === 'ebeveyn'
  const actingParent = authUser?.actingParent
  const themeCtx = useContext(ThemeContext)

  useEffect(() => {
    if (!open) return undefined

    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

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
          className="flex items-center gap-1.5 rounded-lg bg-panel-blue-soft px-2.5 py-1 text-xs font-medium text-panel-blue hover:opacity-80 disabled:opacity-60"
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
        <div className="flex items-center gap-1.5" role="group" aria-label="Renk tonu seç">
          {THEMES.map((option) => {
            const isActive = option.id === themeCtx.theme
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => themeCtx.setTheme(option.id)}
                aria-label={option.label}
                aria-pressed={isActive}
                title={option.label}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 motion-safe:transition-transform ${
                  isActive ? 'border-panel-blue' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: option.swatches[2] }}
              >
                {isActive ? <Check size={12} className="text-white" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="true"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-panel-surface-soft"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-blue-soft text-xs font-semibold text-panel-blue">
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
