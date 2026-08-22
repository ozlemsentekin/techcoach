import { NavLink } from 'react-router-dom'
import NavIcon from './NavIcon'
import { STUDENT_SIDEBAR_NAV } from './navConfig'

export default function StudentSidebar() {
  return (
    <aside className="hidden shrink-0 flex-col bg-panel-surface px-2 py-5 shadow-panel-1 md:flex md:w-20 xl:w-64 xl:px-3">
      <div className="mb-5 flex h-9 items-center gap-2 border-b border-panel-border px-1 pb-5 xl:px-2">
        <img src="/icon-192.png" alt="" className="h-7 w-7 shrink-0 rounded-lg" />
        <span className="hidden truncate text-xl font-bold tracking-wide text-panel-text xl:inline">TechCoach</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Öğrenci menüsü">
        {STUDENT_SIDEBAR_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-2.5 py-2 text-base font-medium transition-colors md:justify-center xl:justify-start ${
                isActive
                  ? 'bg-student-theme-primary text-student-theme-button-text shadow-sm'
                  : 'text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text'
              }`
            }
          >
            <NavIcon name={item.icon} size={18} />
            <span className="hidden xl:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
