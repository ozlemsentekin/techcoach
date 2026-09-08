import SidebarShell from './SidebarShell'
import SidebarNav from './SidebarNav'
import { STUDENT_NAV } from './navConfig'

export default function StudentSidebar() {
  return (
    <SidebarShell>
      <SidebarNav items={STUDENT_NAV} variant="student" ariaLabel="Öğrenci menüsü" />
    </SidebarShell>
  )
}
