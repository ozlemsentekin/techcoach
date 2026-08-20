import { useEffect, useMemo, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { getHomeworks, addHomework } from '../../../services/homeworkService'
import { todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import AddHomeworkModal from '../components/AddHomeworkModal'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import { groupHomeworksByDate, isHomeworkCompleted } from '../../shared/homework/homeworkDisplay'
import HomeworkDateAccordion from '../../shared/homework/HomeworkDateAccordion'

const FILTER_TABS = [
  { key: 'active', label: 'Aktif' },
  { key: 'all', label: 'Tümü' },
]

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [expandedDateOverrides, setExpandedDateOverrides] = useState({})
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    let ignore = false
    getHomeworks()
      .then((data) => {
        if (!ignore) setHomeworks(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const today = todayISODate()
  const visibleHomeworks = useMemo(() => {
    if (!homeworks) return []
    if (filter === 'all') return homeworks
    return homeworks.filter(
      (homework) => !homework.dueDate || homework.dueDate >= today || !isHomeworkCompleted(homework),
    )
  }, [homeworks, filter, today])
  const visibleGroups = useMemo(() => groupHomeworksByDate(visibleHomeworks), [visibleHomeworks])

  const isDateOpen = (dueDate, index) => {
    const key = dueDate || 'unassigned'
    if (Object.prototype.hasOwnProperty.call(expandedDateOverrides, key)) {
      return expandedDateOverrides[key]
    }
    return index === 0
  }

  const toggleDate = (dueDate, index) => {
    const key = dueDate || 'unassigned'
    setExpandedDateOverrides((prev) => ({ ...prev, [key]: !isDateOpen(dueDate, index) }))
  }

  const handleSave = async (payload) => {
    try {
      await addHomework(payload)
      setHomeworks(await getHomeworks())
      setShowModal(false)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader
        title="Ödevlerim"
        actions={
          <Button
            onClick={() => setShowModal(true)}
            className="h-10 rounded-[10px] bg-student-theme-primary px-4 text-sm font-medium text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline-student-theme-primary"
          >
            + Ödev Ekle
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : homeworks === null ? (
        <LoadingState label="Ödevler yükleniyor..." />
      ) : homeworks.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Henüz ödev eklenmedi"
          description="Bugünkü planlama görevinden veya buradan yeni bir ödev ekleyebilirsin."
        />
      ) : (
        <>
          <div className="flex gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={filter === tab.key}
                onClick={() => setFilter(tab.key)}
                className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors ${
                  filter === tab.key
                    ? 'bg-student-theme-primary text-student-theme-button-text shadow-sm'
                    : 'bg-student-theme-soft text-student-theme-text hover:bg-student-theme-primary hover:text-student-theme-button-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {visibleGroups.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="Aktif ödev yok"
              description="Bugün, gelecek tarihli ya da gecikmiş ödev kalmadı."
            />
          ) : (
            <div className="fade-slide-in flex flex-col gap-4">
              {visibleGroups.map((dateGroup, index) => (
                <HomeworkDateAccordion
                  key={dateGroup.dueDate || 'unassigned'}
                  dateGroup={dateGroup}
                  isOpen={isDateOpen(dateGroup.dueDate, index)}
                  onToggle={() => toggleDate(dateGroup.dueDate, index)}
                  isPast={Boolean(dateGroup.dueDate) && dateGroup.dueDate < today}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showModal ? <AddHomeworkModal onSave={handleSave} onClose={() => setShowModal(false)} /> : null}
    </div>
  )
}
