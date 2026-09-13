import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { getStudentNav } from './navConfig'

export default function StudentSidebar() {
  const lessonNotesEnabled = useLessonNotesAccess()
  const nav = getStudentNav({ lessonNotesEnabled })
  return (
    <SidebarShell>
      <SidebarNav items={nav} variant="student" ariaLabel="Öğrenci menüsü" />
    </SidebarShell>
  )
}
