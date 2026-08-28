import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../ui/utils'

export function SchoolResourceAvatar({ resource, size = 'md' }) {
  const dimClass = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  if (resource?.imageUrl) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={resource.imageUrl}
        alt={`${resource.name} görseli`}
        className={cn(dimClass, 'shrink-0 rounded-full border border-panel-border object-cover')}
      />
    )
  }
  return (
    <span className={cn(dimClass, 'flex shrink-0 items-center justify-center rounded-full bg-panel-warm-soft text-panel-warm')}>
      <BookOpen size={size === 'sm' ? 16 : 18} aria-hidden="true" />
    </span>
  )
}

// Okul Ödevi için okul+sınıf+ders bazlı okul kaynağı seçimi (bkz. api/src/schoolResources.js).
// Yuvarlak profil resmi + kaynak adı.
export default function SchoolResourceDropdown({ resources, selectedResource, onSelect, placeholder }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) searchInputRef.current?.focus()
  }, [open])

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr')
    if (!normalized) return resources
    return resources.filter((resource) => resource.name?.toLocaleLowerCase('tr').includes(normalized))
  }, [resources, query])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          setQuery('')
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-panel-border bg-white p-2.5 text-left shadow-sm outline-none transition-colors hover:border-panel-warm focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
      >
        {selectedResource ? (
          <>
            <SchoolResourceAvatar resource={selectedResource} />
            <span className="line-clamp-1 flex-1 text-sm font-semibold text-panel-text">{selectedResource.name}</span>
          </>
        ) : (
          <span className="flex-1 py-1.5 text-sm text-panel-text-muted">{placeholder}</span>
        )}
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-panel-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute z-10 mt-2 flex max-h-72 w-full flex-col rounded-xl border border-panel-border bg-white p-2 shadow-lg">
          {resources.length === 0 ? (
            <p className="p-3 text-sm text-panel-text-muted">Bu derse tanımlı okul kaynağı yok.</p>
          ) : (
            <>
              <div className="relative mb-1.5 shrink-0">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-panel-text-muted"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Kaynak ara"
                  className="w-full rounded-lg border border-panel-border bg-white py-2 pl-8 pr-2.5 text-sm text-panel-text outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </div>
              {filteredResources.length === 0 ? (
                <p className="p-3 text-sm text-panel-text-muted">Aramanızla eşleşen kaynak yok.</p>
              ) : (
            <div className="flex flex-col gap-1 overflow-y-auto">
              {filteredResources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => {
                    onSelect(resource)
                    setOpen(false)
                    setQuery('')
                  }}
                  aria-pressed={selectedResource?.id === resource.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2 text-left transition-colors',
                    selectedResource?.id === resource.id
                      ? 'border-panel-blue bg-panel-blue-soft/45'
                      : 'border-transparent hover:bg-panel-warm-soft/50',
                  )}
                >
                  <SchoolResourceAvatar resource={resource} size="sm" />
                  <span className="line-clamp-1 flex-1 text-sm font-medium text-panel-text">{resource.name}</span>
                  {selectedResource?.id === resource.id ? (
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-blue text-white">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
