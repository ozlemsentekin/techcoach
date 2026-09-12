import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import { NavLink, useLocation } from 'react-router-dom'
import NavIcon from './NavIcon'
import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { useAuth } from '../../context/useAuth'
import { useParentStudentsGate } from '../parent/useParentStudentsGate'
import { PARENT_ADMIN_NAV, getParentNav } from './navConfig'

export default function ParentSidebar() {
  const location = useLocation()
  const { authUser } = useAuth()
  const lessonNotesEnabled = useLessonNotesAccess()
  const { hasStudents, studentCount } = useParentStudentsGate()
  const isAdminSection = location.pathname.startsWith('/parent/admin')

  if (isAdminSection) {
    return (
      <SidebarShell>
        <div className="flex flex-1 flex-col gap-0.5">
          <NavLink
            to="/parent/dashboard"
            title="Panele Dön"
            className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text md:flex-col md:justify-center md:gap-1 md:px-1 lg:flex-row lg:justify-start lg:gap-3 lg:px-3"
          >
            <NavIcon name="Undo2" size={16} />
            <span className="max-w-full text-center text-[10px] leading-tight lg:truncate lg:text-left lg:text-sm">
              Panele Dön
            </span>
          </NavLink>
          <SidebarNav
            items={[{ key: 'admin', label: PARENT_ADMIN_NAV.label, children: PARENT_ADMIN_NAV.children }]}
            variant="parent"
            ariaLabel="Admin menüsü"
          />
        </div>
      </SidebarShell>
    )
  }

  const nav = getParentNav({ lessonNotesEnabled,
    hasStudents,
    canManageLibrary: Boolean(authUser?.canManageLibrary),
    isAdmin: Boolean(authUser?.isAdmin),
    studentCount,
  })

  return (
    <SidebarShell>
      <SidebarNav items={nav} variant="parent" ariaLabel="Ebeveyn menüsü" />
    </SidebarShell>
  )
}
