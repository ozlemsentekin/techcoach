import { useEffect, useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../LoadingState'
import EmptyState from '../EmptyState'
import PublisherCatalogScreen from './PublisherCatalogScreen'

export default function LibraryCatalogPage({ role }) {
  const { authUser } = useAuth()
  const canEdit = Boolean(authUser?.isAdmin || authUser?.canManageLibrary)
  const [subjects, setSubjects] = useState(null)
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setSubjects(data.subjects)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  // Öğretmenler kütüphanede sadece kendi branşlarının sekmelerini görür; branşı henüz
  // atanmamış (eski) öğretmen hesaplarında geriye dönük uyumluluk için tüm dersler gösterilir.
  const teacherSubjectIds = authUser?.teacherSubjectIds
  const visibleSubjects = useMemo(() => {
    if (!subjects) return null
    if (role !== 'teacher' || !teacherSubjectIds?.length) return subjects
    const normalizedIds = teacherSubjectIds.map((id) => id.toLowerCase())
    return subjects.filter((subject) => normalizedIds.includes(subject.id.toLowerCase()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, role, teacherSubjectIds?.length])

  useEffect(() => {
    if (!visibleSubjects) return
    setActiveSubjectId((current) => current || visibleSubjects[0]?.id || null)
  }, [visibleSubjects])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kütüphane"
        subtitle={
          canEdit
            ? 'Bir ders seçip mevcut kaynaklara göz atın veya yeni kaynak ekleyin.'
            : 'Bir ders seçip mevcut kaynaklara göz atın.'
        }
      />

      {error ? <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div> : null}

      {visibleSubjects === null ? (
        <LoadingState label="Dersler yükleniyor..." />
      ) : visibleSubjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Kütüphanede gösterilecek ders yok"
          description="Henüz tanımlı bir ders bulunmuyor."
        />
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
            {visibleSubjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => setActiveSubjectId(subject.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                  activeSubjectId === subject.id
                    ? 'border-panel-blue text-panel-blue'
                    : 'border-transparent text-panel-text-muted hover:text-panel-text'
                }`}
              >
                {subject.name}
              </button>
            ))}
          </div>

          {activeSubjectId ? <PublisherCatalogScreen subjectId={activeSubjectId} /> : null}
        </>
      )}
    </div>
  )
}
