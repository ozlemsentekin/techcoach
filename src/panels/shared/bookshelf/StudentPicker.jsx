import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

// Kitaplık kaynağının hangi çocuk/öğrencilere atanacağını seçmek için ortak liste.
// Kapalı durumda seçili öğrenciler etiket (chip) olarak gösterilir; tıklanınca açılan
// panelde arama kutusu ve onay kutulu liste ile seçim yapılır.
export default function StudentPicker({ students, selectedIds, onToggle, savingIds }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selectedStudents = useMemo(
    () => students.filter((student) => selectedIds.has(String(student.id))),
    [students, selectedIds],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    if (!q) return students
    return students.filter((student) =>
      [student.fullName, student.parentName]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(q)),
    )
  }, [students, query])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-panel-border bg-white px-3 py-2 text-left text-sm outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
      >
        {selectedStudents.length === 0 ? (
          <span className="flex-1 text-panel-text-muted">Öğrenci seçin...</span>
        ) : (
          <span className="flex flex-1 flex-wrap gap-1.5">
            {selectedStudents.map((student) => {
              const key = String(student.id)
              return (
                <span
                  key={key}
                  className="flex items-center gap-1 rounded-lg bg-panel-blue-soft px-2 py-1 text-xs font-medium text-panel-blue"
                >
                  {student.fullName}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`${student.fullName} seçimini kaldır`}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!savingIds?.has(key)) onToggle(student.id)
                    }}
                    className="rounded-full p-0.5 hover:bg-panel-blue/10"
                  >
                    <X size={12} aria-hidden="true" />
                  </span>
                </span>
              )
            })}
          </span>
        )}
        <ChevronDown size={16} className="shrink-0 text-panel-text-muted" />
      </button>

      {open ? (
        <div className="panel-card absolute z-10 mt-1 w-full bg-panel-surface p-2">
          <div className="relative mb-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Öğrenci ara..."
              className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-3 text-sm text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
            />
          </div>

          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-2 text-sm text-panel-text-muted">Eşleşen öğrenci yok.</p>
            ) : (
              filtered.map((student) => {
                const key = String(student.id)
                const checked = selectedIds.has(key)
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      checked ? 'border-panel-blue bg-panel-blue-soft' : 'border-panel-border hover:border-panel-blue'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={savingIds?.has(key)}
                      onChange={() => onToggle(student.id)}
                      className="h-4 w-4 shrink-0 accent-panel-blue"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-panel-text">{student.fullName}</span>
                    {student.grade ? (
                      <span className="shrink-0 text-xs text-panel-text-muted">{student.grade}. sınıf</span>
                    ) : null}
                    {student.parentName ? (
                      <span className="hidden shrink-0 text-xs text-panel-text-muted sm:inline">
                        · {student.parentName}
                      </span>
                    ) : null}
                  </label>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
