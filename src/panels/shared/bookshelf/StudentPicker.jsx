import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

// Kitaplık kaynağının hangi çocuk/öğrencilere atanacağını seçmek için ortak liste.
// Liste uzunsa (admin = tüm öğrenciler) arama kutusu ve kaydırmalı alan gösterilir.
export default function StudentPicker({ students, selectedIds, onToggle, savingIds }) {
  const [query, setQuery] = useState('')
  const long = students.length > 6

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
    <div className="flex flex-col gap-2">
      {long ? (
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Öğrenci ara..."
            className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-3 text-sm text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
          />
        </div>
      ) : null}

      <div
        className={`flex flex-col gap-1.5 ${
          long ? 'max-h-64 overflow-y-auto rounded-xl border border-panel-border p-2' : ''
        }`}
      >
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
                  <span className="hidden shrink-0 text-xs text-panel-text-muted sm:inline">· {student.parentName}</span>
                ) : null}
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
