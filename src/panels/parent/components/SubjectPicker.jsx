import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * İki sütunlu ders seçici: soldaki liste ortaokulda okutulan tüm dersleri (bkz. dbo.Subjects,
 * GET /api/panel/subjects) alfabetik sırayla gösterir; bir derse tıklamak onu sağdaki
 * "öğrencinin dersleri" listesine taşır, sağdaki bir derse tıklamak geri çıkarır.
 */
export default function SubjectPicker({ allSubjects, selectedIds, onChange }) {
  const selectedSet = new Set(selectedIds || [])
  const available = (allSubjects || []).filter((subject) => !selectedSet.has(subject.id))
  const selected = (allSubjects || []).filter((subject) => selectedSet.has(subject.id))

  const addSubject = (id) => {
    onChange([...(selectedIds || []), id])
  }

  const removeSubject = (id) => {
    onChange((selectedIds || []).filter((current) => current !== id))
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-panel-border">
        <div className="border-b border-panel-border bg-[#f8f7fb] px-3 py-2 text-sm font-semibold text-panel-text">
          Tüm Dersler
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {available.length === 0 ? (
            <p className="px-2 py-2 text-xs text-panel-text-muted">Eklenecek ders kalmadı.</p>
          ) : (
            available.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => addSubject(subject.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-panel-text hover:bg-[#f8f7fb]"
              >
                {subject.name}
                <ChevronRight size={15} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-panel-border">
        <div className="border-b border-panel-border bg-[#f8f7fb] px-3 py-2 text-sm font-semibold text-panel-text">
          Öğrencinin Dersleri
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {selected.length === 0 ? (
            <p className="px-2 py-2 text-xs text-panel-text-muted">Henüz ders seçilmedi.</p>
          ) : (
            selected.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => removeSubject(subject.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-panel-text hover:bg-[#f8f7fb]"
              >
                <ChevronLeft size={15} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
                {subject.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
