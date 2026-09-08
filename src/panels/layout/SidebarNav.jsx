import { NavLink, useLocation } from 'react-router-dom'
import NavIcon from './NavIcon'
import { isNavItemActive } from './navConfig'

// Sakin, tek düzeydeki panel menüsü: grup başlıkları sessiz (küçük, büyük harf, gri),
// öğeler ince gri, yalnızca aktif sayfa vurgulu. Öğrenci / veli / öğretmen panelleri
// aynı bileşeni kullanır; renk vurgusu `variant` ile değişir.
const VARIANTS = {
  student: {
    active: 'bg-student-theme-primary font-semibold text-student-theme-button-text',
    idle: 'font-medium text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text',
  },
  parent: {
    active: 'bg-[#f8e3d0] font-semibold text-[#b85f22]',
    idle: 'font-medium text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text',
  },
}
VARIANTS.teacher = VARIANTS.parent

const LABEL_CLASS =
  'max-w-full text-center text-[10px] leading-tight lg:truncate lg:text-left lg:text-sm'

const SECTION_CLASS =
  'px-3 pb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-panel-text-muted lg:text-left'

function itemClass(variant, active) {
  const v = VARIANTS[variant] || VARIANTS.student
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors md:flex-col md:justify-center md:gap-1 md:px-1 md:py-2 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 ${
    active ? v.active : v.idle
  }`
}

function Leaf({ item, variant, location }) {
  return (
    <NavLink
      to={item.to}
      title={item.label}
      className={() => itemClass(variant, isNavItemActive(item.to, location))}
    >
      <NavIcon name={item.icon} size={18} />
      <span className={LABEL_CLASS}>{item.label}</span>
    </NavLink>
  )
}

export default function SidebarNav({ items, variant = 'student', ariaLabel }) {
  const location = useLocation()

  return (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label={ariaLabel}>
      {items.map((item, index) => {
        if (item.children) {
          return (
            <div key={item.key || item.label} className="mt-5 first:mt-0">
              <div className={SECTION_CLASS}>{item.label}</div>
              <div className="flex flex-col gap-0.5">
                {item.children.map((child) => (
                  <Leaf key={child.to} item={child} variant={variant} location={location} />
                ))}
              </div>
            </div>
          )
        }

        const firstAfterGroup = Boolean(items[index - 1]?.children)
        return (
          <div key={item.to} className={firstAfterGroup ? 'mt-5 border-t border-panel-border pt-4' : ''}>
            <Leaf item={item} variant={variant} location={location} />
          </div>
        )
      })}
    </nav>
  )
}
