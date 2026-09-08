import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { useAuth } from '../../context/useAuth'
import { getTeacherNav } from './navConfig'

export default function TeacherSidebar() {
  const { authUser } = useAuth()
  const nav = getTeacherNav(Boolean(authUser?.isAdmin || authUser?.canManageLibrary))

  return (
    <SidebarShell>
      <SidebarNav items={nav} variant="teacher" ariaLabel="Öğretmen menüsü" />
    </SidebarShell>
  )
}
