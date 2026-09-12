import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import { Outlet, useLocation } from 'react-router-dom'
import { BillingGateProvider } from '../../context/BillingGateContext'
import BillingBanner from './BillingBanner'
import StudentSidebar from './StudentSidebar'
import ParentSidebar from './ParentSidebar'
import TeacherSidebar from './TeacherSidebar'
import PanelHeader from './PanelHeader'
import MobileBottomNavigation from './MobileBottomNavigation'
import { useAuth } from '../../context/useAuth'
import { useParentStudentsGate } from '../parent/useParentStudentsGate'
import {
  getStudentNav,
  getParentNav,
  getTeacherNav,
  navToMobile,
  PARENT_ADMIN_NAV,
} from './navConfig'

const SIDEBAR_BY_ROLE = { parent: ParentSidebar, student: StudentSidebar, teacher: TeacherSidebar }
const RETURN_TO_PANEL_ITEM = { to: '/parent/dashboard', label: 'Panele Dön', icon: 'Undo2' }

export default function PanelLayout({ role }) {
  const location = useLocation()
  const { authUser } = useAuth()
  const lessonNotesEnabled = useLessonNotesAccess()
  const { hasStudents, studentCount } = useParentStudentsGate()
  const Sidebar = SIDEBAR_BY_ROLE[role] || StudentSidebar
  const isAdminSection = role === 'parent' && location.pathname.startsWith('/parent/admin')
  const canManageLibrary = Boolean(authUser?.isAdmin || authUser?.canManageLibrary)
  const roleNav =
    role === 'parent'
      ? getParentNav({ lessonNotesEnabled,
          hasStudents,
          canManageLibrary: Boolean(authUser?.canManageLibrary),
          isAdmin: Boolean(authUser?.isAdmin),
          studentCount,
        })
      : role === 'teacher'
        ? getTeacherNav(canManageLibrary, lessonNotesEnabled)
        : getStudentNav({ lessonNotesEnabled, aiReportsEnabled: Boolean(authUser?.aiReportsEnabled) })
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
