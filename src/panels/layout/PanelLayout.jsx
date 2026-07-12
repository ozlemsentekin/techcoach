import { Outlet } from 'react-router-dom'
import StudentSidebar from './StudentSidebar'
import ParentSidebar from './ParentSidebar'
import MobileBottomNavigation from './MobileBottomNavigation'
import {
  STUDENT_PRIMARY_NAV,
  STUDENT_MORE_NAV,
  PARENT_PRIMARY_NAV,
} from './navConfig'

export default function PanelLayout({ role }) {
  const Sidebar = role === 'parent' ? ParentSidebar : StudentSidebar
  const primaryItems = role === 'parent' ? PARENT_PRIMARY_NAV : STUDENT_PRIMARY_NAV
  const moreItems = role === 'parent' ? [] : STUDENT_MORE_NAV

  return (
    <div className="min-h-screen bg-panel-bg">
      <div className="mx-auto flex max-w-6xl">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>
      <MobileBottomNavigation primaryItems={primaryItems} moreItems={moreItems} />
    </div>
  )
}
