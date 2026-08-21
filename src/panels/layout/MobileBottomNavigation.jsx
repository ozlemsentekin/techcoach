import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import NavIcon from './NavIcon'
import { isNavItemActive } from './navConfig'

export default function MobileBottomNavigation({ primaryItems, moreItems = [] }) {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()
  const isMoreActive = moreItems.some((item) => isNavItemActive(item.to, location))

  return (
    <>
      <nav
        aria-label="Alt gezinme"
        className="fixed inset-x-0 bottom-0 z-40 flex min-w-0 overflow-hidden bg-panel-surface shadow-panel-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mx-1 my-1 flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-medium ${
                isActive ? 'bg-student-theme-primary text-student-theme-button-text' : 'text-panel-text-muted'
              }`
            }
          >
            <NavIcon name={item.icon} size={20} />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
        {moreItems.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            aria-haspopup="true"
            aria-expanded={showMore}
            className={`mx-1 my-1 flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-medium ${
              isMoreActive ? 'bg-student-theme-primary text-student-theme-button-text' : 'text-panel-text-muted'
            }`}
          >
            <NavIcon name="MoreHorizontal" size={20} />
            <span className="max-w-full truncate">Daha Fazla</span>
          </button>
        ) : null}
      </nav>

      {showMore ? (
        <div
          className="fixed inset-0 z-50 flex items-end overflow-hidden bg-black/30 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Daha fazla menü"
          onClick={() => setShowMore(false)}
        >
          <div
            className="w-full min-w-0 max-w-full rounded-t-3xl bg-panel-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-base font-semibold text-panel-text">Daha Fazla</span>
              <button type="button" aria-label="Kapat" onClick={() => setShowMore(false)}>
                <NavIcon name="X" size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {moreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowMore(false)}
                  className={() =>
                    `flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-base font-medium ${
                      isNavItemActive(item.to, location) ? 'bg-student-theme-primary text-student-theme-button-text' : 'text-panel-text'
                    }`
                  }
                >
                  <NavIcon name={item.icon} size={20} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
