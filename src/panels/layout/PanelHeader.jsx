import { useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronRight,
  HeartPulse,
  KeyRound,
  LifeBuoy,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Undo2,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { cachedGet } from '../../services/authClient'
import { getCheckIn, saveCheckIn } from '../../services/checkInService'
import { ENERGY_LEVELS, ENERGY_MESSAGES } from '../../data/taskTypes'
import { todayISODate } from '../../utils/time'
import ThemeContext from '../../theme/themeContextObject'
import { THEMES } from '../../theme/themes'
import ChangePasswordDialog from './ChangePasswordDialog'

const STUDENT_SUPPORT_EVENT = 'student-support-requested'
const STUDENT_ENERGY_UPDATED_EVENT = 'student-energy-updated'
const PENDING_SUPPORT_KEY = 'student_support_pending'
const ROLE_LABELS = {
  ebeveyn: 'Ebeveyn hesabı',
  ogrenci: 'Öğrenci hesabı',
  ogretmen: 'Öğretmen hesabı',
}

function StudentWellbeingMenu({
  checkIn,
  open,
  saving,
  error,
  onToggle,
  onSelectEnergy,
  onOpenSupport,
  menuRef,
}) {
  const selectedEnergy = ENERGY_LEVELS.find((level) => level.id === checkIn?.energyLevel)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Durumum"
        className="flex h-9 items-center gap-2 rounded-full border border-panel-border bg-panel-surface px-2.5 text-sm font-semibold text-panel-text shadow-sm hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
      >
        <HeartPulse size={16} className="shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Durumum</span>
        {selectedEnergy ? <span className="text-base leading-none" aria-hidden="true">{selectedEnergy.icon}</span> : null}
        <ChevronDown size={14} className="hidden shrink-0 sm:block" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-x-4 top-16 z-50 rounded-2xl border border-panel-border bg-panel-surface p-2 shadow-panel-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80">
          <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wide text-panel-text-muted">Durumum</span>
            {selectedEnergy ? (
              <span className="truncate rounded-full bg-student-theme-soft px-2.5 py-1 text-xs font-semibold text-student-theme-text">
                {selectedEnergy.icon} {selectedEnergy.label}
              </span>
            ) : null}
          </div>

          <div className="grid gap-1">
            {ENERGY_LEVELS.map((level) => {
              const selected = checkIn?.energyLevel === level.id

              return (
                <button
                  key={level.id}
                  type="button"
                  disabled={saving}
                  onClick={() => onSelectEnergy(level.id)}
                  aria-pressed={selected}
                  className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                    selected
                      ? 'bg-student-theme-primary text-student-theme-button-text'
                      : 'text-panel-text hover:bg-panel-surface-soft'
                  }`}
                >
                  <span className="text-base" aria-hidden="true">{level.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{level.label}</span>
                  {selected ? <Check size={15} className="shrink-0" aria-hidden="true" /> : null}
                </button>
              )
            })}
          </div>

          <p className="mt-2 rounded-xl bg-panel-surface-soft px-3 py-2 text-xs font-medium leading-relaxed text-panel-text-muted">
            {selectedEnergy ? ENERGY_MESSAGES[selectedEnergy.id] : 'Bugünkü enerjini seç; günün temposu görünür olsun.'}
          </p>

          {error ? <p className="mt-2 px-1 text-xs font-medium text-panel-red">{error}</p> : null}

          <button
            type="button"
            onClick={onOpenSupport}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-student-theme-primary/25 bg-panel-surface px-3 text-sm font-semibold text-student-theme-text hover:bg-student-theme-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
          >
            <LifeBuoy size={16} aria-hidden="true" />
            Destek Al
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function PanelHeader({ role }) {
  const { authUser, logout, enterStudent, returnToParent, returnToAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [wellbeingOpen, setWellbeingOpen] = useState(false)
  const [checkIn, setCheckIn] = useState(null)
  const [wellbeingSaving, setWellbeingSaving] = useState(false)
  const [wellbeingError, setWellbeingError] = useState('')
  const [students, setStudents] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const menuRef = useRef(null)
  const themeMenuRef = useRef(null)
  const wellbeingMenuRef = useRef(null)
  const todayDate = todayISODate()
  const initial = authUser?.fullName?.trim()?.[0]?.toUpperCase() || '?'
  const displayName = authUser?.fullName?.trim() || 'Hesap'
  const firstName = displayName.split(' ')[0]
  const roleLabel = ROLE_LABELS[authUser?.role] || 'Hesap'
  const contactLabel = authUser?.email || authUser?.phone || roleLabel
  const isParent = authUser?.role === 'ebeveyn'
  const isStudentPanel = role === 'student'
  const actingParent = authUser?.actingParent
  const actingAdmin = authUser?.actingAdmin
  const themeCtx = useContext(ThemeContext)
  const activeTheme = themeCtx ? THEMES.find((theme) => theme.id === themeCtx.theme) || THEMES[0] : null

  useEffect(() => {
    if (!open && !themeOpen && !wellbeingOpen) return undefined

    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setThemeOpen(false)
      }
      if (wellbeingMenuRef.current && !wellbeingMenuRef.current.contains(event.target)) {
        setWellbeingOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, themeOpen, wellbeingOpen])

  useEffect(() => {
    if (!open || !isParent || students !== null) return

    cachedGet('/api/parent/students')
      .then((data) => setStudents(data.students))
      .catch(() => setStudents([]))
  }, [open, isParent, students])

  useEffect(() => {
    if (!isStudentPanel) return undefined

    let ignore = false
    getCheckIn(todayDate)
      .then((data) => {
        if (!ignore) setCheckIn(data)
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [isStudentPanel, todayDate])

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

  const handleReturnToAdmin = async () => {
    setSwitching(true)
    try {
      await returnToAdmin()
      setOpen(false)
      navigate('/parent/admin/users')
    } catch {
      // no-op: session stays as-is if the call fails
    } finally {
      setSwitching(false)
    }
  }

  const handleSelectEnergy = async (levelId) => {
    setWellbeingSaving(true)
    setWellbeingError('')
    try {
      const nextCheckIn = await saveCheckIn(todayDate, { energyLevel: levelId, note: checkIn?.note })
      setCheckIn(nextCheckIn)
      window.dispatchEvent(new CustomEvent(STUDENT_ENERGY_UPDATED_EVENT, { detail: { checkIn: nextCheckIn } }))
    } catch (err) {
      setWellbeingError(err.message)
    } finally {
      setWellbeingSaving(false)
    }
  }

  const handleOpenSupport = () => {
    setWellbeingOpen(false)
    if (location.pathname === '/student/today') {
      window.dispatchEvent(new CustomEvent(STUDENT_SUPPORT_EVENT))
      return
    }

    window.sessionStorage.setItem(PENDING_SUPPORT_KEY, '1')
    navigate('/student/today')
  }

  return (
    <header className="sticky top-0 z-20 min-w-0 border-b border-panel-border bg-panel-surface px-3 sm:px-4 md:px-6 xl:px-8">
      <div className="mx-auto flex h-14 w-full max-w-[1480px] min-w-0 items-center justify-end gap-2 sm:gap-3">
      {actingParent ? (
        <button
          type="button"
          onClick={handleReturnToParent}
          disabled={switching}
          className="flex min-w-0 items-center gap-1.5 rounded-lg bg-student-theme-soft px-2.5 py-1 text-xs font-medium text-student-theme-text hover:opacity-80 disabled:opacity-60"
        >
          <Undo2 size={13} aria-hidden="true" />
          <span className="hidden sm:inline">Ebeveyn Paneline Dön</span>
        </button>
      ) : null}

      {actingAdmin ? (
        <button
          type="button"
          onClick={handleReturnToAdmin}
          disabled={switching}
          className="flex min-w-0 items-center gap-1.5 rounded-lg bg-panel-lilac-soft px-2.5 py-1 text-xs font-medium text-panel-lilac hover:opacity-80 disabled:opacity-60"
        >
          <Undo2 size={13} aria-hidden="true" />
          <span className="hidden sm:inline">Yönetici Paneline Dön</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => window.location.reload()}
        aria-label="Sayfayı yenile"
        title="Sayfayı yenile"
        className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
      >
        <RefreshCw size={16} aria-hidden="true" />
      </button>
      <div className="h-6 w-px shrink-0 bg-panel-border" aria-hidden="true" />

      {themeCtx && !themeCtx.locked ? (
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => {
              setThemeOpen((value) => !value)
              setOpen(false)
            }}
            aria-haspopup="true"
            aria-expanded={themeOpen}
            aria-label="Stil seç"
            className="flex h-9 items-center gap-2 rounded-full border border-panel-border bg-panel-surface px-2.5 text-sm font-semibold text-panel-text shadow-sm hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
          >
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: activeTheme?.swatches[2] }}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Stil</span>
            <ChevronDown size={14} className="hidden shrink-0 sm:block" aria-hidden="true" />
          </button>

          {themeOpen ? (
            <div className="fixed inset-x-4 top-16 z-50 rounded-2xl border border-panel-border bg-panel-surface p-2 shadow-panel-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
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

      {isStudentPanel ? (
        <StudentWellbeingMenu
          checkIn={checkIn}
          open={wellbeingOpen}
          saving={wellbeingSaving}
          error={wellbeingError}
          menuRef={wellbeingMenuRef}
          onToggle={() => {
            setWellbeingOpen((value) => !value)
            setThemeOpen(false)
            setOpen(false)
          }}
          onSelectEnergy={handleSelectEnergy}
          onOpenSupport={handleOpenSupport}
        />
      ) : null}

      <div className="relative min-w-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value)
            setThemeOpen(false)
            setWellbeingOpen(false)
          }}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="Hesap menüsü"
          className={`flex h-10 min-w-0 items-center gap-2 rounded-full border px-2 py-1 transition-colors ${
            open
              ? 'border-panel-blue-soft bg-panel-blue-soft/50 text-panel-text'
              : 'border-transparent text-panel-text hover:border-panel-border hover:bg-panel-surface-soft'
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-student-theme-soft text-xs font-bold text-student-theme-text">
            {initial}
          </div>
          <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">
            {firstName}
          </span>
          <ChevronDown
            size={14}
            className={`hidden shrink-0 text-panel-text-muted transition-transform sm:block ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] min-w-0 overflow-y-auto overflow-x-hidden rounded-2xl border border-panel-border bg-panel-surface shadow-[0_18px_48px_rgba(31,36,77,0.16)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80">
            <div className="border-b border-panel-border bg-panel-surface-soft/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-student-theme-primary text-sm font-extrabold text-student-theme-button-text">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-panel-text">{displayName}</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-panel-text-muted">{contactLabel}</p>
                </div>
              </div>
              <span className="mt-2 inline-flex rounded-full border border-panel-border bg-panel-surface px-2.5 py-1 text-[11px] font-bold text-panel-text-muted">
                {authUser?.isAdmin ? 'Admin yetkili ebeveyn hesabı' : roleLabel}
              </span>
            </div>

            {isParent ? (
              <div className="border-b border-panel-border px-2 py-2">
                <div className="px-2 pb-1 text-[11px] font-bold text-panel-text-muted">
                  Öğrenciye geç
                </div>
                {students === null ? (
                  <div className="rounded-xl px-3 py-2 text-sm font-medium text-panel-text-muted">Yükleniyor...</div>
                ) : students.length === 0 ? (
                  <div className="rounded-xl px-3 py-2 text-sm font-medium text-panel-text-muted">Bağlı öğrenci yok.</div>
                ) : (
                  students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      disabled={switching}
                      onClick={() => handleEnterStudent(student.id)}
                      className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-panel-text transition-colors hover:bg-panel-blue-soft/50 disabled:opacity-60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-blue-soft text-panel-blue">
                        <Users size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{student.fullName}</span>
                        <span className="block truncate text-xs font-medium text-panel-text-muted">Öğrenci paneli</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="grid gap-1 p-2">
              {isParent && authUser?.isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    navigate('/parent/admin/users')
                  }}
                  className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-panel-text transition-colors hover:bg-panel-surface-soft"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-accent-soft text-panel-warm">
                    <ShieldCheck size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">Admin Paneli</span>
                  <ChevronRight size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
                </button>

              ) : null}

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setChangePasswordOpen(true)
                }}
                className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-panel-text transition-colors hover:bg-panel-surface-soft"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
                  <KeyRound size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">Şifremi Değiştir</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  logout().catch(() => {})
                }}
                className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-panel-red transition-colors hover:bg-panel-red-soft"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-red-soft text-panel-red">
                  <LogOut size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">Çıkış Yap</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      </div>

      {changePasswordOpen ? <ChangePasswordDialog onClose={() => setChangePasswordOpen(false)} /> : null}
    </header>
  )
}
