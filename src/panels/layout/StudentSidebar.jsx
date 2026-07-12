import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import NavIcon from './NavIcon'
import { STUDENT_SIDEBAR_NAV } from './navConfig'

export default function StudentSidebar() {
  const { authUser, logout } = useAuth()

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-panel-border bg-panel-surface px-4 py-6 md:flex">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold text-panel-text">{authUser?.fullName?.split(' ')[0]}</p>
        <p className="text-sm text-panel-text-muted">Bugün için hazırsın</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Öğrenci menüsü">
        {STUDENT_SIDEBAR_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors ${
                isActive
                  ? 'bg-panel-blue-soft text-panel-blue'
                  : 'text-panel-text-muted hover:bg-panel-bg hover:text-panel-text'
              }`
            }
          >
            <NavIcon name={item.icon} size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => logout().catch(() => {})}
        aria-label="Çıkış yap"
        className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium text-panel-text-muted hover:bg-panel-bg hover:text-panel-text"
      >
        <NavIcon name="LogOut" size={18} />
        Çıkış Yap
      </button>
    </aside>
  )
}
