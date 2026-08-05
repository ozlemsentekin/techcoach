import { useEffect, useState } from 'react'
import { Phone, UserRound, Users } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import { getTeacherParents } from '../../../services/teacherService'

export default function ParentsPage() {
  const [parents, setParents] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    getTeacherParents()
      .then((data) => {
        if (!ignore) setParents(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Velilerim" subtitle="Yetki verilen öğrencilerin velileri." />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : parents === null ? (
        <LoadingState label="Veliler yükleniyor..." />
      ) : parents.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Henüz veli yok"
          description="Bir veli size panel yetkisi verdiğinde burada listelenir."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {parents.map((parent) => (
            <div
              key={parent.id}
              className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-panel-1"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                  <UserRound size={22} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-panel-text">{parent.fullName}</p>
                  {parent.phone ? (
                    <a
                      href={`tel:${parent.phone.replace(/\s/g, '')}`}
                      className="mt-0.5 inline-flex items-center gap-1 text-sm text-panel-text-muted"
                    >
                      <Phone size={12} aria-hidden="true" />
                      {parent.phone}
                    </a>
                  ) : null}
                </div>
              </div>

              <p className="inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
                <Users size={14} aria-hidden="true" />
                {parent.students.map((student) => student.fullName).join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
