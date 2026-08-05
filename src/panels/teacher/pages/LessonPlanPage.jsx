import { useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import { getTeacherLessonPlan } from '../../../services/teacherService'
import LessonScheduleGrid from '../components/LessonScheduleGrid'

export default function LessonPlanPage() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    getTeacherLessonPlan()
      .then((data) => {
        if (!ignore) setEntries(data)
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
      <PageHeader title="Ders Planım" subtitle="Özel ders verdiğiniz öğrencilerin haftalık programı." />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : entries === null ? (
        <LoadingState label="Ders planı yükleniyor..." />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Ders programı yok"
          description="Özel ders programı tanımlanmış bir öğrenciniz olduğunda haftalık planınız burada görünür."
        />
      ) : (
        <LessonScheduleGrid entries={entries} />
      )}
    </div>
  )
}
