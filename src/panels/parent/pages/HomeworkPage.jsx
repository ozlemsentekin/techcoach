import { useEffect, useMemo, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { getHomeworks, addHomework, deleteHomework } from '../../../services/homeworkService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import AddHomeworkModal from '../../student/components/AddHomeworkModal'
import Button from '../../ui/Button'
import { MotionDiv } from '../../ui/motion'
import { groupHomeworksByDate } from '../../shared/homework/homeworkDisplay'
import HomeworkDateAccordion from '../../shared/homework/HomeworkDateAccordion'

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [deletingHomework, setDeletingHomework] = useState(null)
  const [expandedDateOverrides, setExpandedDateOverrides] = useState({})

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
            className="h-10 rounded-[10px] bg-[#655e94] px-4 text-sm font-medium text-white hover:opacity-90"
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
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          {groupedByDate.map((dateGroup, index) => (
            <HomeworkDateAccordion
              key={dateGroup.dueDate || 'unassigned'}
              dateGroup={dateGroup}
              isOpen={isDateOpen(dateGroup.dueDate, index)}
              onToggle={() => toggleDate(dateGroup.dueDate, index)}
              onDeleteRequest={setDeletingHomework}
            />
          ))}
        </MotionDiv>
      )}

      {showModal ? <AddHomeworkModal onSave={handleSave} onClose={() => setShowModal(false)} /> : null}

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
