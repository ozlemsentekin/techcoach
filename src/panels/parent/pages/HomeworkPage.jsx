import { Fragment, useEffect, useMemo, useState } from 'react'
import { NotebookPen, Trash2 } from 'lucide-react'
import { getHomeworks, addHomework, deleteHomework } from '../../../services/homeworkService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import AddHomeworkModal from '../../student/components/AddHomeworkModal'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'
import { getSubjectTone } from '../../../utils/subjectStyles'

function formatGroupDate(dueDate) {
  return new Date(dueDate).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })
}

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [deletingHomework, setDeletingHomework] = useState(null)

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

  const groupedByDate = useMemo(() => {
    if (!homeworks) return []
    const dateGroups = new Map()
    homeworks.forEach((homework) => {
      if (!dateGroups.has(homework.dueDate)) dateGroups.set(homework.dueDate, new Map())
      const subjectGroups = dateGroups.get(homework.dueDate)
      if (!subjectGroups.has(homework.subject)) subjectGroups.set(homework.subject, [])
      subjectGroups.get(homework.subject).push(homework)
    })
    return Array.from(dateGroups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dueDate, subjectGroups]) => ({
        dueDate,
        subjects: Array.from(subjectGroups.entries()).map(([subject, items]) => ({ subject, items })),
      }))
  }, [homeworks])

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
    <div className="flex flex-col gap-5">
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
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#655e94]">
                  <th className="px-4 py-3">Yayınevi</th>
                  <th className="px-4 py-3">Ödev</th>
                  <th className="px-4 py-3">İlerleme</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f1]">
                {groupedByDate.map((dateGroup) => (
                  <Fragment key={dateGroup.dueDate}>
                    <tr>
                      <td colSpan={4} className="bg-[#f8f7fb] px-4 py-2 text-sm font-bold text-[#253d3e]">
                        {formatGroupDate(dateGroup.dueDate)}
                      </td>
                    </tr>
                    {dateGroup.subjects.map((subjectGroup) => (
                      <Fragment key={subjectGroup.subject}>
                        <tr>
                          <td colSpan={4} className="px-4 pb-1 pt-3">
                            <div className="flex items-center gap-2">
                              <Badge tone={getSubjectTone(subjectGroup.subject)}>{subjectGroup.subject}</Badge>
                              <span className="text-xs text-[#667475]">{subjectGroup.items.length} ödev</span>
                            </div>
                          </td>
                        </tr>
                        {subjectGroup.items.map((homework) => {
                          const progress =
                            homework.totalQuestionCount > 0
                              ? Math.round((homework.completedQuestionCount / homework.totalQuestionCount) * 100)
                              : null
                          const isReading = homework.resourceType === 'okuma_kitabi'
                          return (
                            <tr key={homework.id} className="hover:bg-[#f8f7fb]">
                              <td className="px-4 py-3">
                                {homework.publisherName ? <Badge tone="lilac">{homework.publisherName}</Badge> : <span className="text-sm text-[#667475]">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-[#253d3e]">{homework.title}</td>
                              <td className="px-4 py-3">
                                {progress === null ? (
                                  isReading && homework.totalPageCount > 0 ? (
                                    <span className="text-sm text-[#667475]">{homework.totalPageCount} sayfa</span>
                                  ) : (
                                    <span className="text-sm text-[#667475]">—</span>
                                  )
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#eff3f4]">
                                      <div className="h-full rounded-full bg-[#655e94]" style={{ width: `${progress}%` }} />
                                    </div>
                                    <span className="text-xs text-[#667475]">
                                      {homework.completedQuestionCount}/{homework.totalQuestionCount}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right">
                                <button
                                  type="button"
                                  aria-label="Ödevi sil"
                                  onClick={() => setDeletingHomework(homework)}
                                  className="rounded-lg p-1.5 text-[#9aa0a6] hover:bg-panel-accent-soft hover:text-panel-warm"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </DataTable>
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
