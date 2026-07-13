import { useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { createTask } from '../../../services/taskService'
import { addDaysISO, todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function MistakesPage() {
  const [banner, setBanner] = useState('')
  const groups = useMemo(() => {
    const wrongQuestions = getWrongQuestions()
    const bySubjectTopic = {}

    wrongQuestions.forEach((item) => {
      const key = item.topic ? `${item.subject} – ${item.topic}` : item.subject
      if (!bySubjectTopic[key]) {
        bySubjectTopic[key] = { key, subject: item.subject, topic: item.topic, count: 0, errorTypes: {} }
      }
      bySubjectTopic[key].count += 1
      bySubjectTopic[key].errorTypes[item.errorType] = (bySubjectTopic[key].errorTypes[item.errorType] || 0) + 1
    })

    return Object.values(bySubjectTopic).sort((a, b) => b.count - a.count)
  }, [])

  const handleCreateReviewTask = (group) => {
    const tomorrow = addDaysISO(todayISODate(), 1)
    createTask(tomorrow, {
      title: `${group.subject} Yanlış Tekrarı`,
      description: group.topic ? `${group.topic} konusundaki yanlışların tekrarı` : 'Yanlışların tekrarı',
      subject: group.subject,
      topic: group.topic,
      taskType: 'yanlis-tekrari',
      startTime: '17:00',
      endTime: '17:30',
      durationMinutes: 30,
    })
    setBanner(`${group.subject} için yarına bir tekrar görevi eklendi.`)
    window.setTimeout(() => setBanner(''), 4000)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Yanlışlar" subtitle="Aylin'in yanlış yaptığı soru ve konular." />

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState icon={AlertCircle} title="Henüz yanlış kaydı yok" description="Aylin bir ödev kontrolü tamamladığında burada görünecek." />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-panel-border bg-panel-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-panel-text">{group.key}</p>
                <span className="text-sm text-panel-text-muted">{group.count} yanlış</span>
              </div>
              <p className="mt-1 text-sm text-panel-text-muted">
                {Object.entries(group.errorTypes)
                  .map(([type, count]) => `${count} ${type}`)
                  .join(' · ')}
              </p>
              <button
                type="button"
                onClick={() => handleCreateReviewTask(group)}
                className="mt-3 rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text hover:bg-panel-bg"
              >
                Tekrar görevi oluştur
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
