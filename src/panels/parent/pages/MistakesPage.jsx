import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { createTask } from '../../../services/taskService'
import { addDaysISO, todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'

function groupWrongQuestions(wrongQuestions) {
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
}

export default function MistakesPage() {
  const [banner, setBanner] = useState('')
  const [groups, setGroups] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    getWrongQuestions()
      .then((data) => {
        if (!ignore) setGroups(groupWrongQuestions(data))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const handleCreateReviewTask = async (group) => {
    const tomorrow = addDaysISO(todayISODate(), 1)
    try {
      await createTask(tomorrow, {
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
    } catch (err) {
      setBanner(err.message)
    }
    window.setTimeout(() => setBanner(''), 4000)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Yanlışlar" />

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : groups === null ? (
        <LoadingState label="Yanlışlar yükleniyor..." />
      ) : groups.length === 0 ? (
        <EmptyState icon={AlertCircle} title="Henüz yanlış kaydı yok" description="Aylin bir ödev kontrolü tamamladığında burada görünecek." />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#1c2b5e]">
                  <th className="px-4 py-3">Konu</th>
                  <th className="px-4 py-3">Hata Dağılımı</th>
                  <th className="px-4 py-3 text-center">Yanlış</th>
                  <th className="px-4 py-3 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f1]">
                {groups.map((group) => (
                  <tr key={group.key} className="hover:bg-[#f8f7fb]">
                    <td className="px-4 py-3 text-sm font-semibold text-[#253d3e]">{group.key}</td>
                    <td className="px-4 py-3 text-sm text-[#667475]">
                      {Object.entries(group.errorTypes)
                        .map(([type, count]) => `${count} ${type}`)
                        .join(' · ')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone="warm">{group.count}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-[34px] rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#f8f7fb]"
                        onClick={() => handleCreateReviewTask(group)}
                      >
                        Tekrar görevi oluştur
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </MotionDiv>
      )}
    </div>
  )
}
