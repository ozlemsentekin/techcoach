import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { useAuth } from '../../context/useAuth'
import { getTeacherNav } from './navConfig'

export default function TeacherSidebar() {
  const { authUser } = useAuth()
  const lessonNotesEnabled = useLessonNotesAccess()
  const nav = getTeacherNav(Boolean(authUser?.isAdmin || authUser?.canManageLibrary), lessonNotesEnabled)

  return (
    <SidebarShell>
      <SidebarNav items={nav} variant="teacher" ariaLabel="Öğretmen menüsü" />
    </SidebarShell>
  )
}
