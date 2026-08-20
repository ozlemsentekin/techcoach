import { useEffect, useMemo, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { getHomeworks, addHomework, updateHomework, deleteHomework, assignHomeworkTask } from '../../../services/homeworkService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import AddHomeworkModal from '../../student/components/AddHomeworkModal'
import AssignTaskModal from '../../shared/homework/AssignTaskModal'
import EditHomeworkModal from '../../shared/homework/EditHomeworkModal'
import Button from '../../ui/Button'
import { groupHomeworksByDate } from '../../shared/homework/homeworkDisplay'
import HomeworkDateAccordion from '../../shared/homework/HomeworkDateAccordion'

const FILTER_TABS = [
  { key: 'active', label: 'Aktif' },
  { key: 'all', label: 'Tümü' },
]

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [deletingHomework, setDeletingHomework] = useState(null)
  const [editingHomework, setEditingHomework] = useState(null)
  const [assigningTaskHomework, setAssigningTaskHomework] = useState(null)
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

  const groupedByDate = useMemo(() => groupHomeworksByDate(homeworks), [homeworks])
  const visibleGroups = useMemo(
    () => (filter === 'active' ? groupedByDate.filter((dateGroup) => dateGroup.completionPercentage < 100) : groupedByDate),
    [groupedByDate, filter],
  )

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
      setError('')
      await addHomework(payload)
      setHomeworks(await getHomeworks())
      setShowModal(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAssignTaskSave = async ({ date, startTime, durationMinutes }) => {
    await assignHomeworkTask(assigningTaskHomework.id, { date, startTime, durationMinutes })
    setHomeworks(await getHomeworks())
    setAssigningTaskHomework(null)
  }

  const handleEditSave = async (updates) => {
    await updateHomework(editingHomework.id, updates)
    setHomeworks(await getHomeworks())
    setEditingHomework(null)
  }

  const handleDeleteConfirmed = async () => {
    const homeworkId = deletingHomework?.id
    setDeletingHomework(null)
    try {
      setError('')
      await deleteHomework(homeworkId)
      setHomeworks(await getHomeworks())
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader
        title="Ödevler"
        actions={
          <Button
            onClick={() => setShowModal(true)}
            className="h-10 rounded-[10px] bg-[#1c2b5e] px-4 text-sm font-medium text-white hover:opacity-90"
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
        <EmptyState icon={NotebookPen} title="Henüz ödev eklenmedi" description="Yukarıdaki butonla ilk ödevi ekleyebilirsin." />
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
                    ? 'bg-panel-blue text-white shadow-sm'
                    : 'bg-panel-blue-soft text-panel-blue hover:bg-panel-blue hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {visibleGroups.length === 0 ? (
            <EmptyState icon={NotebookPen} title="Aktif ödev yok" description="Tüm ödevler tamamlandı." />
          ) : (
            <div className="fade-slide-in flex flex-col gap-4">
              {visibleGroups.map((dateGroup, index) => (
                <HomeworkDateAccordion
                  key={dateGroup.dueDate || 'unassigned'}
                  dateGroup={dateGroup}
                  isOpen={isDateOpen(dateGroup.dueDate, index)}
                  onToggle={() => toggleDate(dateGroup.dueDate, index)}
                  onDeleteRequest={setDeletingHomework}
                  onEditRequest={setEditingHomework}
                  onAssignTaskRequest={setAssigningTaskHomework}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showModal ? <AddHomeworkModal onSave={handleSave} onClose={() => setShowModal(false)} /> : null}

      {assigningTaskHomework ? (
        <AssignTaskModal
          homework={assigningTaskHomework}
          onSave={handleAssignTaskSave}
          onClose={() => setAssigningTaskHomework(null)}
        />
      ) : null}

      {editingHomework ? (
        <EditHomeworkModal
          homework={editingHomework}
          onSave={handleEditSave}
          onClose={() => setEditingHomework(null)}
        />
      ) : null}

      {deletingHomework ? (
        <ConfirmationDialog
          title="Ödevi sil"
          description={`"${deletingHomework.title}" ödevini silmek istediğine emin misin?`}
          confirmLabel="Sil"
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeletingHomework(null)}
        />
      ) : null}
    </div>
  )
}
