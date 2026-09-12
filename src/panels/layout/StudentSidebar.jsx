import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import { useAuth } from '../../context/useAuth'
import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { getStudentNav } from './navConfig'

export default function StudentSidebar() {
  const { authUser } = useAuth()
  const lessonNotesEnabled = useLessonNotesAccess()
  const nav = getStudentNav({ lessonNotesEnabled, aiReportsEnabled: Boolean(authUser?.aiReportsEnabled) })
  return (
    <SidebarShell>
      <SidebarNav items={nav} variant="student" ariaLabel="Öğrenci menüsü" />
    </SidebarShell>
  )
}
