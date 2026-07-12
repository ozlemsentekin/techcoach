import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import NavIcon from './NavIcon'

export default function MobileBottomNavigation({ primaryItems, moreItems = [] }) {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.to))

  return (
    <>
      <nav
        aria-label="Alt gezinme"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-panel-border bg-panel-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                isActive ? 'text-panel-blue' : 'text-panel-text-muted'
              }`
            }
          >
            <NavIcon name={item.icon} size={20} />
            {item.label}
          </NavLink>
        ))}
        {moreItems.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            aria-haspopup="true"
            aria-expanded={showMore}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
              isMoreActive ? 'text-panel-blue' : 'text-panel-text-muted'
            }`}
          >
            <NavIcon name="MoreHorizontal" size={20} />
            Daha Fazla
          </button>
        ) : null}
      </nav>

      {showMore ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/30 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Daha fazla menü"
          onClick={() => setShowMore(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-panel-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
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
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium ${
                      isActive ? 'bg-panel-blue-soft text-panel-blue' : 'text-panel-text'
                    }`
                  }
                >
                  <NavIcon name={item.icon} size={20} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
