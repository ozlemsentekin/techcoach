import { NavLink } from 'react-router-dom'
import NavIcon from './NavIcon'
import { STUDENT_SIDEBAR_NAV } from './navConfig'

export default function StudentSidebar() {
  return (
    <aside className="hidden shrink-0 flex-col bg-panel-surface px-2 py-5 shadow-panel-1 md:flex md:w-28 lg:w-64 lg:px-3">
      <div className="mb-5 flex h-12 flex-col items-center justify-center gap-1 border-b border-panel-border px-1 pb-5 lg:h-9 lg:flex-row lg:justify-start lg:gap-2 lg:px-2">
        <img src="/icon-192.png" alt="" className="h-7 w-7 shrink-0 rounded-lg" />
        <span className="block max-w-full truncate text-[11px] font-bold tracking-wide text-panel-text lg:text-xl">
          TechCoach
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Öğrenci menüsü">
        {STUDENT_SIDEBAR_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `flex min-h-[58px] items-center gap-3 rounded-xl px-2.5 py-2 text-base font-medium transition-colors md:flex-col md:justify-center md:gap-1 md:px-1.5 lg:min-h-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-2.5 ${
                isActive
                  ? 'bg-student-theme-primary text-student-theme-button-text shadow-sm'
                  : 'text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text'
              }`
            }
          >
            <NavIcon name={item.icon} size={18} />
            <span className="line-clamp-2 max-w-full text-center text-[11px] font-semibold leading-tight lg:line-clamp-none lg:truncate lg:text-left lg:text-base">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
