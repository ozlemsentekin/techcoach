import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

const ACTION_MENU_WIDTH = 180
const ACTION_MENU_ESTIMATED_HEIGHT = 92
const ACTION_MENU_VIEWPORT_PADDING = 8
const ACTION_MENU_GAP = 6

function getActionMenuPosition(buttonRect, menuHeight = ACTION_MENU_ESTIMATED_HEIGHT) {
  const left = Math.min(
    Math.max(ACTION_MENU_VIEWPORT_PADDING, buttonRect.right - ACTION_MENU_WIDTH),
    window.innerWidth - ACTION_MENU_WIDTH - ACTION_MENU_VIEWPORT_PADDING,
  )
  const hasRoomBelow = window.innerHeight - buttonRect.bottom >= menuHeight + ACTION_MENU_GAP
  const top = hasRoomBelow
    ? buttonRect.bottom + ACTION_MENU_GAP
    : Math.max(ACTION_MENU_VIEWPORT_PADDING, buttonRect.top - menuHeight - ACTION_MENU_GAP)

  return { left, top }
}

export default function ActionsMenu({ items, isOpen, onToggle, onClose, triggerLabel = 'İşlemler', disabled = false }) {
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState(null)
  // Aynı satır için hem mobil kart hem masaüstü tablo ayrı bir ActionsMenu render eder ve
  // ikisi genelde tek bir "açık menü" state'ini paylaşır. O an CSS ile gizli (display:none
  // ata üzerinden) olan kopya, ekranın sol üstünde bir hayalet menü çizmesin ve görünür
  // kopyadaki tıklamayı dış-tıklama sayıp kapatmasın diye tamamen pasifleştiriyoruz.
  // offsetParent, display:none bir ata varsa null olur (buton position:fixed değil).
  const [hidden, setHidden] = useState(false)

  useLayoutEffect(() => {
    if (!isOpen) return undefined

    const updateMenuPosition = () => {
      const button = buttonRef.current
      const buttonRect = button?.getBoundingClientRect()
      if (!buttonRect) return

      const isHidden = button.offsetParent === null
      setHidden(isHidden)
      if (isHidden) return

      const menuHeight = menuRef.current?.offsetHeight || ACTION_MENU_ESTIMATED_HEIGHT
      setMenuPosition(getActionMenuPosition(buttonRect, menuHeight))
    }

    const frameId = window.requestAnimationFrame(updateMenuPosition)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || hidden) return undefined

    function handlePointerDown(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      onClose()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, hidden, onClose])

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          if (disabled) return
          if (isOpen) {
            setMenuPosition(null)
          } else if (buttonRef.current) {
            setMenuPosition(getActionMenuPosition(buttonRef.current.getBoundingClientRect()))
          }
          onToggle()
        }}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={triggerLabel}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-panel-border bg-panel-surface text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text disabled:pointer-events-none disabled:opacity-50"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>

      {isOpen && !hidden && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                left: menuPosition?.left ?? 0,
                top: menuPosition?.top ?? 0,
                width: ACTION_MENU_WIDTH,
              }}
              className={`fixed z-[70] overflow-hidden rounded-xl border border-panel-border bg-white py-1 shadow-[0_10px_28px_rgba(37,30,60,0.14)] ${
                menuPosition ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose()
                    item.onClick()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:bg-panel-surface-soft ${
                    item.danger ? 'text-panel-red hover:bg-panel-red-soft' : 'text-panel-text hover:bg-panel-surface-soft'
                  }`}
                >
                  {item.icon ? <item.icon size={14} className="shrink-0" aria-hidden="true" /> : null}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
