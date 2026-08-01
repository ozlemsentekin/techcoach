import { useEffect, useState } from 'react'
import { getHomeworks, addHomework } from '../../../services/homeworkService'
import PageHeader from '../../layout/PageHeader'
import AddHomeworkModal from '../components/AddHomeworkModal'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ödevlerim"
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
        <EmptyState
          title="Henüz ödev eklenmedi"
          description="Bugünkü planlama görevinden veya buradan yeni bir ödev ekleyebilirsin."
        />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            {homeworks.map((homework) => {
              const progress =
                homework.totalQuestionCount > 0
                  ? Math.round((homework.completedQuestionCount / homework.totalQuestionCount) * 100)
                  : null
              return (
                <div
                  key={homework.id}
                  className="flex items-center gap-3 border-b border-[#edf0f1] px-4 py-3 last:border-0 hover:bg-[#f8f7fb]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="blue">{homework.subject}</Badge>
                      <h3 className="truncate text-sm font-semibold text-[#253d3e]">{homework.title}</h3>
                    </div>
                    {progress !== null ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#eff3f4]">
                          <div className="h-full rounded-full bg-[#655e94]" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-[#667475]">
                          {homework.completedQuestionCount}/{homework.totalQuestionCount} soru
                        </span>
                      </div>
                    ) : null}
                    {homework.isSplit ? (
                      <p className="mt-1 text-xs text-[#667475]">
                        {homework.dayPlans.map((plan) => `${plan.date}: ${plan.questionCount} soru`).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-[#667475]">{homework.dueDate}</span>
                </div>
              )
            })}
          </DataTable>
        </MotionDiv>
      )}

      {showModal ? <AddHomeworkModal onSave={handleSave} onClose={() => setShowModal(false)} /> : null}
    </div>
  )
}
