import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Library, Users } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import { LIBRARY_GRADES } from './libraryConstants'

export default function LibraryGradesPage({ role }) {
  const navigate = useNavigate()
  const isTeacher = role === 'teacher'
  const basePath = isTeacher ? '/teacher/library' : '/parent/library'

  const [grades, setGrades] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    const url = isTeacher ? '/api/panel-teacher/students' : '/api/parent/students'

    authRequest(url, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        const studentGrades = new Set(
          (data.students || []).map((student) => (isTeacher ? student.studentGrade : student.grade)),
        )
        setGrades(LIBRARY_GRADES.filter((grade) => studentGrades.has(grade)))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [isTeacher])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Kütüphane" subtitle="Sınıfa göre kaynakları görüntüle ve öğrencilerine ata." />

      {error ? <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div> : null}

      {grades === null ? (
        <LoadingState label="Yükleniyor..." />
      ) : grades.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Kütüphanede gösterilecek sınıf yok"
          description={
            isTeacher
              ? 'Öğrencilerinizin sınıf bilgisi 5-8. sınıf aralığında değil veya henüz tanımlanmamış.'
              : 'Çocuklarınızın sınıf bilgisi 5-8. sınıf aralığında değil veya henüz tanımlanmamış.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {grades.map((grade) => (
            <div
              key={grade}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`${basePath}/${grade}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`${basePath}/${grade}`)
                }
              }}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-panel-border bg-panel-surface p-6 text-center shadow-panel-1 transition-colors hover:border-panel-blue"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                <Library size={28} aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-bold text-panel-text">{grade}. Sınıf</p>
                <p className="text-sm text-panel-text-muted">Dersler ve kaynaklar</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
