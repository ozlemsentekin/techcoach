import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import NavIcon from './NavIcon'
import { PARENT_ADMIN_NAV, PARENT_SIDEBAR_NAV, isNavItemActive } from './navConfig'

export default function ParentSidebar() {
  const { authUser } = useAuth()
  const location = useLocation()
  const isAdminSectionActive = location.pathname.startsWith('/parent/admin')
  const [adminOpen, setAdminOpen] = useState(isAdminSectionActive)

  return (
    <aside className="hidden shrink-0 flex-col bg-panel-surface px-2 py-5 shadow-panel-1 md:flex md:w-20 lg:w-64 lg:px-3">
      <div className="mb-5 flex h-9 items-center gap-2 border-b border-panel-border px-1 pb-5 lg:px-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel-blue text-xs font-bold text-white">
          T
        </div>
        <span className="hidden truncate text-xl font-bold tracking-wide text-panel-text lg:inline">TechCoach</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Ebeveyn menüsü">
        {PARENT_SIDEBAR_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={() =>
              `flex items-center gap-3 rounded-xl px-2.5 py-2 text-base font-medium transition-colors md:justify-center lg:justify-start ${
                isNavItemActive(item.to, location)
                  ? 'bg-panel-blue-soft text-panel-blue'
                  : 'text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text'
              }`
            }
          >
            <NavIcon name={item.icon} size={18} />
            <span className="hidden lg:inline">{item.label}</span>
          </NavLink>
        ))}

        {authUser?.isAdmin ? (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setAdminOpen((open) => !open)}
              aria-expanded={adminOpen}
              title={PARENT_ADMIN_NAV.label}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-base font-medium transition-colors md:justify-center lg:justify-start ${
                isAdminSectionActive
                  ? 'bg-panel-blue-soft text-panel-blue'
                  : adminOpen
                    ? 'bg-panel-surface-soft text-panel-text'
                    : 'text-panel-text hover:bg-panel-surface-soft'
              }`}
            >
              <NavIcon name={PARENT_ADMIN_NAV.icon} size={18} />
              <span className="hidden flex-1 text-left lg:inline">{PARENT_ADMIN_NAV.label}</span>
              <NavIcon name={adminOpen ? 'ChevronDown' : 'ChevronRight'} size={16} className="hidden lg:block" />
            </button>

            {adminOpen ? (
              <div className="flex flex-col gap-0.5 lg:ml-4 lg:border-l lg:border-panel-border lg:pl-3">
                {PARENT_ADMIN_NAV.children.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors md:justify-center lg:justify-start ${
                        isActive
                          ? 'bg-panel-blue-soft text-panel-blue'
                          : 'text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text'
                      }`
                    }
                  >
                    <NavIcon name={item.icon} size={16} />
                    <span className="hidden lg:inline">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
    </aside>
  )
}
