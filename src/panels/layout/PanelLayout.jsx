import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import StudentSidebar from './StudentSidebar'
import ParentSidebar from './ParentSidebar'
import TeacherSidebar from './TeacherSidebar'
import PanelHeader from './PanelHeader'
import MobileBottomNavigation from './MobileBottomNavigation'
import {
  STUDENT_PRIMARY_NAV,
  STUDENT_MORE_NAV,
  PARENT_PRIMARY_NAV,
  PARENT_MORE_NAV,
  PARENT_ADMIN_NAV,
  TEACHER_PRIMARY_NAV,
  TEACHER_MORE_NAV,
} from './navConfig'

const SIDEBAR_BY_ROLE = { parent: ParentSidebar, student: StudentSidebar, teacher: TeacherSidebar }

export default function PanelLayout({ role }) {
  const { authUser } = useAuth()
  const Sidebar = SIDEBAR_BY_ROLE[role] || StudentSidebar
  const primaryItems = role === 'parent' ? PARENT_PRIMARY_NAV : role === 'teacher' ? TEACHER_PRIMARY_NAV : STUDENT_PRIMARY_NAV
  const moreItems =
    role === 'parent'
      ? [...PARENT_MORE_NAV, ...(authUser?.isAdmin ? PARENT_ADMIN_NAV.children : [])]
      : role === 'teacher'
        ? TEACHER_MORE_NAV
        : STUDENT_MORE_NAV

  return (
    <div className="min-h-screen bg-panel-bg" data-panel-role={role}>
      <div className="flex">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelHeader role={role} />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNavigation primaryItems={primaryItems} moreItems={moreItems} />
    </div>
  )
}
