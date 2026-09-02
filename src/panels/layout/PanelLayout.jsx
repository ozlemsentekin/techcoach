import { Outlet, useLocation } from 'react-router-dom'
import StudentSidebar from './StudentSidebar'
import ParentSidebar from './ParentSidebar'
import TeacherSidebar from './TeacherSidebar'
import PanelHeader from './PanelHeader'
import MobileBottomNavigation from './MobileBottomNavigation'
import { useAuth } from '../../context/useAuth'
import { useParentStudentsGate } from '../parent/useParentStudentsGate'
import { useTeacherClasses } from '../teacher/useTeacherClasses'
import {
  STUDENT_PRIMARY_NAV,
  STUDENT_MORE_NAV,
  getParentPrimaryNav,
  getParentMoreNav,
  PARENT_ADMIN_NAV,
  getTeacherPrimaryNav,
  TEACHER_MORE_NAV,
} from './navConfig'

const SIDEBAR_BY_ROLE = { parent: ParentSidebar, student: StudentSidebar, teacher: TeacherSidebar }
const RETURN_TO_PANEL_ITEM = { to: '/parent/dashboard', label: 'Panele Dön', icon: 'Undo2' }

export default function PanelLayout({ role }) {
  const location = useLocation()
  const { authUser } = useAuth()
  const { hasStudents } = useParentStudentsGate()
  const { studentCount: teacherStudentCount } = useTeacherClasses()
  const Sidebar = SIDEBAR_BY_ROLE[role] || StudentSidebar
  const isAdminSection = role === 'parent' && location.pathname.startsWith('/parent/admin')
  const canManageLibrary = Boolean(authUser?.isAdmin || authUser?.canManageLibrary)
  const primaryItems = isAdminSection
    ? [RETURN_TO_PANEL_ITEM]
    : role === 'parent'
      ? getParentPrimaryNav(hasStudents, canManageLibrary)
      : role === 'teacher'
        ? getTeacherPrimaryNav(canManageLibrary, { studentCount: teacherStudentCount })
        : STUDENT_PRIMARY_NAV
  const moreItems = isAdminSection
    ? PARENT_ADMIN_NAV.children
    : role === 'parent'
      ? getParentMoreNav(authUser?.isAdmin, hasStudents)
      : role === 'teacher'
        ? TEACHER_MORE_NAV
        : STUDENT_MORE_NAV

  return (
    <div className="min-h-screen bg-panel-bg" data-panel-role={role}>
      <div className="flex min-w-0">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelHeader />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-6 xl:px-8">
            <div className="mx-auto flex w-full max-w-[1480px] min-w-0 flex-col">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <MobileBottomNavigation primaryItems={primaryItems} moreItems={moreItems} />
    </div>
  )
}
