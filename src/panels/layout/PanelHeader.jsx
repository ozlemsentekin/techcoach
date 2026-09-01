import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Undo2,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { cachedGet } from '../../services/authClient'
import ThemeContext from '../../theme/themeContextObject'
import { THEMES } from '../../theme/themes'
import ChangePasswordDialog from './ChangePasswordDialog'
import TeacherSubjectsDialog from '../teacher/components/TeacherSubjectsDialog'

const ROLE_LABELS = {
  ebeveyn: 'Ebeveyn hesabı',
  ogrenci: 'Öğrenci hesabı',
  ogretmen: 'Öğretmen hesabı',
}

export default function PanelHeader() {
  const { authUser, logout, enterStudent, returnToParent, returnToAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [students, setStudents] = useState(null)
  const [teacherSubjects, setTeacherSubjects] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState('')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [subjectsDialogOpen, setSubjectsDialogOpen] = useState(false)
  const menuRef = useRef(null)
  const themeMenuRef = useRef(null)
  const initial = authUser?.fullName?.trim()?.[0]?.toUpperCase() || '?'
  const displayName = authUser?.fullName?.trim() || 'Hesap'
  const firstName = displayName.split(' ')[0]
  const roleLabel = ROLE_LABELS[authUser?.role] || 'Hesap'
  const contactLabel = authUser?.email || authUser?.phone || roleLabel
  const isParent = authUser?.role === 'ebeveyn'
  const isTeacher = authUser?.role === 'ogretmen'
  const actingParent = authUser?.actingParent
  const actingAdmin = authUser?.actingAdmin
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

  // Kimlik değiştiğinde (admin bir veliyi impersonate etti, "Yönetici/Ebeveyn Paneline Dön"
  // yapıldı, öğrenci görünümünden çıkıldı) PanelHeader remount OLMUYOR. Bu yüzden bir önceki
  // kullanıcıya ait öğrenci/branş listesini component state'inde temizlemezsek hesap menüsündeki
  // "Öğrenciye geç" başka bir veliye (ör. admin'in kendi çocuğuna) ait ismi göstermeye devam eder.
  useEffect(() => {
    setStudents(null)
    setTeacherSubjects(null)
    setSwitchError('')
  }, [authUser?.id])

  useEffect(() => {
    if (!open || !isParent || students !== null) return

    cachedGet('/api/parent/students')
      .then((data) => setStudents(data.students))
      .catch(() => setStudents([]))
  }, [open, isParent, students])

  useEffect(() => {
    if (!open || !isTeacher || teacherSubjects !== null) return

    cachedGet('/api/panel/subjects')
      .then((data) => setTeacherSubjects(data.subjects))
      .catch(() => setTeacherSubjects([]))
  }, [open, isTeacher, teacherSubjects])

  const teacherSubjectNames = teacherSubjects && authUser?.teacherSubjectIds
    ? teacherSubjects
        .filter((subject) => authUser.teacherSubjectIds.includes(subject.id.toLowerCase()))
        .map((subject) => subject.name)
        .join(', ')
    : ''

  const handleEnterStudent = async (studentId) => {
    setSwitching(true)
    setSwitchError('')
    try {
      await enterStudent(studentId)
      setOpen(false)
      navigate('/student/today')
    } catch (error) {
      // Ör. liste bir önceki kimliğe ait eski veriden geldiyse backend 404 döndürür —
      // sessizce yutmak yerine kullanıcıya göster.
      setSwitchError(error?.message || 'Öğrenci görünümüne geçilemedi. Sayfayı yenileyip tekrar deneyin.')
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

      <div className="relative min-w-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value)
            setThemeOpen(false)
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
              {isTeacher ? (
                <p className="mt-2 truncate text-xs font-medium text-panel-text-muted">
                  Branş: {teacherSubjectNames || 'Henüz seçilmedi'}
                </p>
              ) : null}
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
                {switchError ? (
                  <div className="mx-1 mt-1 rounded-xl bg-panel-red-soft px-3 py-2 text-xs font-medium text-panel-red">
                    {switchError}
                  </div>
                ) : null}
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

              {isTeacher ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setSubjectsDialogOpen(true)
                  }}
                  className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-panel-text transition-colors hover:bg-panel-surface-soft"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
                    <GraduationCap size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">Branşlarım</span>
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
      {subjectsDialogOpen ? <TeacherSubjectsDialog onClose={() => setSubjectsDialogOpen(false)} /> : null}
    </header>
  )
}
