import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import StudentSidebar from './StudentSidebar'
import ParentSidebar from './ParentSidebar'
import PanelHeader from './PanelHeader'
import MobileBottomNavigation from './MobileBottomNavigation'
import {
  STUDENT_PRIMARY_NAV,
  STUDENT_MORE_NAV,
  PARENT_PRIMARY_NAV,
  PARENT_MORE_NAV,
  PARENT_ADMIN_NAV,
} from './navConfig'

export default function PanelLayout({ role }) {
  const { authUser } = useAuth()
  const Sidebar = role === 'parent' ? ParentSidebar : StudentSidebar
  const primaryItems = role === 'parent' ? PARENT_PRIMARY_NAV : STUDENT_PRIMARY_NAV
  const moreItems =
    role === 'parent'
      ? [...PARENT_MORE_NAV, ...(authUser?.isAdmin ? PARENT_ADMIN_NAV.children : [])]
      : STUDENT_MORE_NAV

  return (
    <div className="min-h-screen bg-panel-bg">
      <div className="flex">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelHeader />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNavigation primaryItems={primaryItems} moreItems={moreItems} />
    </div>
  )
}
