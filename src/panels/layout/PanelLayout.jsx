import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import { useSchoolHomeworkAccess } from '../../hooks/useSchoolHomeworkAccess'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BillingGateProvider } from '../../context/BillingGateContext'
import BillingBanner from './BillingBanner'
import StudentSidebar from './StudentSidebar'
import ParentSidebar from './ParentSidebar'
import TeacherSidebar from './TeacherSidebar'
import PanelHeader from './PanelHeader'
import MobileBottomNavigation from './MobileBottomNavigation'
import { useAuth } from '../../context/useAuth'
import { useParentStudentsGate } from '../parent/useParentStudentsGate'
import { useTeacherStudentFocus } from '../../hooks/useTeacherStudentFocus'
import {
  getStudentNav,
  getParentNav,
  getTeacherNav,
  getTeacherStudentFocusNav,
  navToMobile,
  PARENT_ADMIN_NAV,
} from './navConfig'

const SIDEBAR_BY_ROLE = { parent: ParentSidebar, student: StudentSidebar, teacher: TeacherSidebar }
const RETURN_TO_PANEL_ITEM = { to: '/parent/dashboard', label: 'Panele Dön', icon: 'Undo2' }

export default function PanelLayout({ role }) {
  const location = useLocation()
  const { authUser } = useAuth()
  const lessonNotesEnabled = useLessonNotesAccess()
  const schoolHomeworksEnabled = useSchoolHomeworkAccess()
  const { hasStudents, studentCount } = useParentStudentsGate()
  const teacherFocus = useTeacherStudentFocus()
  const Sidebar = SIDEBAR_BY_ROLE[role] || StudentSidebar
  const isAdminSection = role === 'parent' && location.pathname.startsWith('/parent/admin')
  const canManageLibrary = Boolean(authUser?.isAdmin || authUser?.canManageLibrary)
  const roleNav =
    role === 'parent'
      ? getParentNav({ lessonNotesEnabled, schoolHomeworksEnabled,
          hasStudents,
          canManageLibrary: Boolean(authUser?.canManageLibrary),
          isAdmin: Boolean(authUser?.isAdmin),
          studentCount,
        })
      : role === 'teacher'
        ? teacherFocus
          ? getTeacherStudentFocusNav(teacherFocus)
          : getTeacherNav(canManageLibrary, lessonNotesEnabled)
        : getStudentNav({ lessonNotesEnabled, schoolHomeworksEnabled })
  const { primary, more } = navToMobile(roleNav)
  const primaryItems = isAdminSection ? [RETURN_TO_PANEL_ITEM] : primary
  const moreItems = isAdminSection ? PARENT_ADMIN_NAV.children : more

  return (
    <BillingGateProvider>
      <div className="min-h-screen bg-panel-bg" data-panel-role={role}>
        <div className="flex min-w-0">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <PanelHeader />
            <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-6 xl:px-8">
              <div className="mx-auto flex w-full max-w-[1480px] min-w-0 flex-col">
                <BillingBanner />
                {role === 'teacher' && teacherFocus ? <StudentFocusBanner focus={teacherFocus} /> : null}
                <Outlet />
              </div>
            </main>
          </div>
        </div>
        <MobileBottomNavigation primaryItems={primaryItems} moreItems={moreItems} />
      </div>
    </BillingGateProvider>
  )
}

// Öğrenciye özel link sayfalarının (Hata Defteri, Kitaplık, Gelişim Analizi, Sınav Sonuçları)
// üstündeki tek satırlık başlık: "Aylin Şişman · Fen Bilimleri Çeyrek Dönem Analizi".
function StudentFocusBanner({ focus }) {
  const { student, studentTeacherId } = focus
  return (
    <div className="mb-5 flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-panel-blue px-4 py-3 text-white shadow-panel-1 sm:px-5">
      <p className="min-w-0 truncate text-sm font-bold sm:text-base">
        {student ? (
          <>
            {student.studentFullName}
            <span className="font-semibold text-white/70"> · {student.subjectName ? `${student.subjectName} ` : ''}Çeyrek Dönem Analizi</span>
          </>
        ) : (
          'Çeyrek Dönem Analizi'
        )}
      </p>
      <Link
        to={`/teacher/students/${studentTeacherId}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white hover:bg-white/25"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Öğrenci sayfası</span>
      </Link>
    </div>
  )
}
