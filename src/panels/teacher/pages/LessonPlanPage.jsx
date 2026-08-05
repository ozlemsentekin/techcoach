import { useEffect, useState } from 'react'
import { CalendarPlus, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import { addDaysISO, getMondayOfWeek, todayISODate } from '../../../utils/time'
import { getTeacherLessonPlan, getTeacherStudents } from '../../../services/teacherService'
import LessonScheduleGrid from '../components/LessonScheduleGrid'
import AddLessonModal from '../components/AddLessonModal'
import EditLessonModal from '../components/EditLessonModal'

const currentWeekStart = getMondayOfWeek(todayISODate())

function formatWeekRangeLabel(weekDates) {
  const start = new Date(weekDates[0]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  const end = new Date(weekDates[6]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${start} – ${end}`
}

export default function LessonPlanPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = addDaysISO(currentWeekStart, weekOffset * 7)
  const weekDates = Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index))

  const [recurringEntries, setRecurringEntries] = useState(null)
  const [oneTimeEntries, setOneTimeEntries] = useState([])
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)

  const loadLessonPlan = () => {
    return getTeacherLessonPlan(weekStart)
      .then((data) => {
        setRecurringEntries(data.recurringEntries)
        setOneTimeEntries(data.oneTimeEntries)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    let ignore = false

    getTeacherLessonPlan(weekStart)
      .then((data) => {
        if (!ignore) {
          setRecurringEntries(data.recurringEntries)
          setOneTimeEntries(data.oneTimeEntries)
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [weekStart])

  useEffect(() => {
    let ignore = false

    getTeacherStudents()
      .then((data) => {
        if (!ignore) setStudents(data.filter((student) => student.teacherType === 'ozel_ogretmen'))
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [])

  const handleLessonAdded = async () => {
    setShowAddModal(false)
    await loadLessonPlan()
  }

  const handleLessonEdited = async () => {
    setEditingEntry(null)
    await loadLessonPlan()
  }

  const isEmpty = recurringEntries?.length === 0 && oneTimeEntries.length === 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ders Planım"
        subtitle="Özel ders verdiğiniz öğrencilerin haftalık programı."
        actions={
          students?.length ? (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex h-11 items-center gap-2 rounded-xl bg-panel-blue px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              <CalendarPlus size={18} aria-hidden="true" />
              Ders Ekle
            </button>
          ) : null
        }
      />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-surface px-3 py-2.5">
        <button
          type="button"
          onClick={() => setWeekOffset((prev) => prev - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft"
          aria-label="Önceki hafta"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-sm font-bold text-panel-text">{formatWeekRangeLabel(weekDates)}</span>
        <button
          type="button"
          onClick={() => setWeekOffset((prev) => prev + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft"
          aria-label="Sonraki hafta"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : recurringEntries === null ? (
        <LoadingState label="Ders planı yükleniyor..." />
      ) : isEmpty ? (
        <EmptyState
          icon={CalendarRange}
          title="Ders programı yok"
          description="Özel ders programı tanımlanmış bir öğrenciniz olduğunda haftalık planınız burada görünür."
        />
      ) : (
        <LessonScheduleGrid
          recurringEntries={recurringEntries}
          oneTimeEntries={oneTimeEntries}
          weekDates={weekDates}
          onEntryClick={setEditingEntry}
        />
      )}

      {showAddModal ? (
        <AddLessonModal students={students || []} onSave={handleLessonAdded} onClose={() => setShowAddModal(false)} />
      ) : null}

      {editingEntry ? (
        <EditLessonModal
          entry={editingEntry}
          onSave={handleLessonEdited}
          onDelete={handleLessonEdited}
          onClose={() => setEditingEntry(null)}
        />
      ) : null}
    </div>
  )
}
