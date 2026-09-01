import { NavLink, useLocation } from 'react-router-dom'
import NavIcon from './NavIcon'
import { useAuth } from '../../context/useAuth'
import { useParentStudentsGate } from '../parent/useParentStudentsGate'
import { PARENT_ADMIN_NAV, getParentSidebarNav, isNavItemActive } from './navConfig'

const ITEM_CLASS = ({ active }) =>
  `flex min-h-[58px] items-center gap-3 rounded-xl px-2.5 py-2 text-base font-medium transition-colors md:flex-col md:justify-center md:gap-1 md:px-1.5 lg:min-h-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-2.5 ${
    active
      ? 'bg-[#f8e3d0] text-[#b85f22]'
      : 'text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text'
  }`

const LABEL_CLASS =
  'line-clamp-2 max-w-full text-center text-[11px] font-semibold leading-tight lg:line-clamp-none lg:truncate lg:text-left lg:text-base'

export default function ParentSidebar() {
  const location = useLocation()
  const { authUser } = useAuth()
  const { hasStudents } = useParentStudentsGate()
  const isAdminSection = location.pathname.startsWith('/parent/admin')
  const sidebarNav = getParentSidebarNav(
    authUser?.isAdmin,
    hasStudents,
    Boolean(authUser?.isAdmin || authUser?.canManageLibrary),
  )

  return (
    <aside className="hidden shrink-0 flex-col bg-panel-surface px-2 py-5 shadow-panel-1 md:flex md:w-28 lg:w-64 lg:px-3">
      <div className="mb-5 flex h-12 flex-col items-center justify-center gap-1 border-b border-panel-border px-1 pb-5 lg:h-9 lg:flex-row lg:justify-start lg:gap-2 lg:px-2">
        <img src="/icon-192.png" alt="" className="h-7 w-7 shrink-0 rounded-lg" />
        <span className="block max-w-full truncate text-[11px] font-bold tracking-wide text-panel-text lg:text-xl">
          TechCoach
        </span>
      </div>

      {isAdminSection ? (
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin menüsü">
          <NavLink
            to="/parent/dashboard"
            title="Panele Dön"
            className="mb-2 flex min-h-[58px] items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text md:flex-col md:justify-center md:gap-1 md:px-1.5 lg:min-h-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-2.5"
          >
            <NavIcon name="Undo2" size={16} />
            <span className={LABEL_CLASS}>Panele Dön</span>
          </NavLink>

          <div className="px-1.5 pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-panel-text-muted lg:px-2.5 lg:text-left lg:text-xs">
            {PARENT_ADMIN_NAV.label}
          </div>

          {PARENT_ADMIN_NAV.children.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => ITEM_CLASS({ active: isActive })}
            >
              <NavIcon name={item.icon} size={18} />
              <span className={LABEL_CLASS}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      ) : (
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Ebeveyn menüsü">
          {sidebarNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={() => ITEM_CLASS({ active: isNavItemActive(item.to, location) })}
            >
              <NavIcon name={item.icon} size={18} />
              <span className={LABEL_CLASS}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </aside>
  )
}
