import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from './utils'

// Aranabilir tek seçimli açılır liste. `filter={false}` verilip `onSearchChange` ile
// sunucu tarafı arama da beslenebilir (bkz. SchoolPicker). Seçili değer `options`
// içinde yoksa `selectedOption` ile dışarıdan gösterilecek etiket sağlanabilir.
export default function Combobox({
  value,
  onChange,
  options,
  selectedOption = null,
  getOptionValue = (option) => option.id,
  getOptionLabel = (option) => option.name,
  renderOption,
  placeholder = 'Seçin',
  searchPlaceholder = 'Ara...',
  disabled = false,
  loading = false,
  emptyLabel = 'Sonuç yok',
  clearable = false,
  filter = true,
  onSearchChange,
  icon: Icon,
  className,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      return undefined
    }

    const handlePointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 0)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
      clearTimeout(focusTimer)
    }
  }, [open])

  const list = useMemo(() => options || [], [options])
  const selected =
    list.find((option) => String(getOptionValue(option)) === String(value)) ||
    (selectedOption && String(getOptionValue(selectedOption)) === String(value) ? selectedOption : null)

  const filtered = useMemo(() => {
    if (!filter) return list
    const q = query.trim().toLocaleLowerCase('tr-TR')
    if (!q) return list
    return list.filter((option) => getOptionLabel(option).toLocaleLowerCase('tr-TR').includes(q))
  }, [list, query, filter, getOptionLabel])

  const handleQueryChange = (event) => {
    setQuery(event.target.value)
    onSearchChange?.(event.target.value)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl border border-panel-border bg-white p-2.5 text-left text-base text-panel-text transition-colors',
          'focus:border-panel-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-blue/20',
          disabled && 'cursor-not-allowed bg-[#f5f6f7] text-panel-text-muted',
        )}
      >
        {Icon ? <Icon size={16} className="shrink-0 text-panel-blue" aria-hidden="true" /> : null}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-panel-text-muted')}>
          {selected ? getOptionLabel(selected) : placeholder}
        </span>
        {clearable && selected && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Seçimi kaldır"
            className="shrink-0 text-panel-text-muted hover:text-panel-warm"
            onClick={(event) => {
              event.stopPropagation()
              onChange(null, null)
            }}
          >
            <X size={15} aria-hidden="true" />
          </span>
        ) : null}
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-panel-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-panel-border bg-white shadow-panel-2">
          <div className="relative border-b border-panel-border/70 p-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-panel-text-muted"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={handleQueryChange}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-panel-border bg-white py-1.5 pl-8 pr-2 text-sm text-panel-text focus:border-panel-blue focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <p className="px-3 py-2 text-sm text-panel-text-muted">Yükleniyor...</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-panel-text-muted">{emptyLabel}</p>
            ) : (
              filtered.map((option) => {
                const optionValue = getOptionValue(option)
                const isSelected = String(optionValue) === String(value)
                return (
                  <button
                    key={optionValue}
                    type="button"
                    onClick={() => {
                      onChange(optionValue, option)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-panel-surface-soft',
                      isSelected ? 'bg-panel-blue-soft/60 font-medium text-panel-blue' : 'text-panel-text',
                    )}
                  >
                    {renderOption ? renderOption(option) : <span className="truncate">{getOptionLabel(option)}</span>}
                    {isSelected ? <Check size={14} className="shrink-0" aria-hidden="true" /> : null}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
