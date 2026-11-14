import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { useAuth } from '../../context/useAuth'
import { getTeacherNav, getTeacherStudentFocusNav } from './navConfig'
import { useTeacherStudentFocus } from '../../hooks/useTeacherStudentFocus'

export default function TeacherSidebar() {
  const { authUser } = useAuth()
  const lessonNotesEnabled = useLessonNotesAccess()
  const focus = useTeacherStudentFocus()
  const nav = focus
    ? getTeacherStudentFocusNav(focus)
    : getTeacherNav(Boolean(authUser?.isAdmin || authUser?.canManageLibrary), lessonNotesEnabled)

  return (
    <SidebarShell>
      {focus ? <StudentFocusHeader student={focus.student} /> : null}
      <SidebarNav items={nav} variant="teacher" ariaLabel="Öğretmen menüsü" />
    </SidebarShell>
  )
}

// Öğrenciye özel link açıkken menünün üstündeki başlık: "Aylin Şişman · Fen Bilimleri Çeyrek Dönem Analizi".
function StudentFocusHeader({ student }) {
  if (!student) return <div className="mb-4 hidden h-[92px] animate-pulse rounded-2xl bg-panel-surface-soft lg:block" />
  return (
    <div className="mb-4 hidden overflow-hidden rounded-2xl bg-panel-blue px-4 py-3 text-white shadow-panel-1 lg:block">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Çeyrek Dönem Analizi</p>
      <p className="mt-1 break-words text-base font-bold leading-tight">{student.studentFullName}</p>
      {student.subjectName ? (
        <span className="mt-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
          {student.subjectName}
        </span>
      ) : null}
    </div>
  )
}
