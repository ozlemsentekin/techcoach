import { useLessonNotesAccess } from '../../hooks/useLessonNotesAccess'
import { useSchoolHomeworkAccess } from '../../hooks/useSchoolHomeworkAccess'
import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { getStudentNav } from './navConfig'

export default function StudentSidebar() {
  const lessonNotesEnabled = useLessonNotesAccess()
  const schoolHomeworksEnabled = useSchoolHomeworkAccess()
  const nav = getStudentNav({ lessonNotesEnabled, schoolHomeworksEnabled })
  return (
    <SidebarShell>
      <SidebarNav items={nav} variant="student" ariaLabel="Öğrenci menüsü" />
    </SidebarShell>
  )
}
