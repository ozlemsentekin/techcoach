import { useMemo, useState } from 'react'
import { getTasksForDate } from '../../../services/taskService'
import { getCheckIn } from '../../../services/checkInService'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { sendMessage, getMessages } from '../../../services/messageService'
import { todayISODate, formatDateLong } from '../../../utils/time'
import { ENERGY_LEVELS } from '../../../data/taskTypes'
import { PARENT_MESSAGE_TEMPLATES } from '../../../data/coachMessages'
import PageHeader from '../../layout/PageHeader'
import ProgressSummaryCard from '../../shared/ProgressSummaryCard'
import ParentMessageCard from '../components/ParentMessageCard'
import { CheckCircle2, Clock, RotateCw, HeartPulse } from 'lucide-react'

const date = todayISODate()

export default function DashboardPage() {
  const [tasks] = useState(() => getTasksForDate(date))
  const [checkIn] = useState(() => getCheckIn(date))
  const [messages, setMessages] = useState(() => getMessages())
  const [customText, setCustomText] = useState('')

  const summary = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((task) => task.status === 'tamamlandi').length
    const partial = tasks.filter((task) => task.status === 'kismen-tamamlandi').length
    const rescheduled = tasks.filter((task) => task.status === 'yeniden-planlandi').length
    return { total, completed, partial, rescheduled }
  }, [tasks])

  const energyLabel = checkIn
    ? ENERGY_LEVELS.find((level) => level.id === checkIn.energyLevel)?.label
    : 'Henüz belirtilmedi'

  const strugglingTopic = useMemo(() => {
    const counts = {}
    getWrongQuestions().forEach((item) => {
      const key = item.topic ? `${item.subject} – ${item.topic}` : item.subject
      counts[key] = (counts[key] || 0) + 1
    })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] || null
  }, [])

  const handleSendMessage = (text) => {
    if (!text.trim()) return
    sendMessage({ from: 'ebeveyn', text: text.trim() })
    setMessages(getMessages())
    setCustomText('')
  }

  const recentMessages = [...messages].reverse().slice(0, 3)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Bugünün Özeti" subtitle={formatDateLong()} />

      <div className="grid grid-cols-2 gap-3">
        <ProgressSummaryCard
          icon={CheckCircle2}
          title="Tamamlanan"
          value={`${summary.completed} / ${summary.total}`}
          description="Bugün planlanan görevlerden"
        />
        <ProgressSummaryCard
          icon={Clock}
          title="Kısmen tamamlanan"
          value={summary.partial}
          description="Emek gösterilen görevler"
        />
        <ProgressSummaryCard
          icon={RotateCw}
          title="Yeniden planlanan"
          value={summary.rescheduled}
          description="Kaybolmadı, taşındı"
        />
        <ProgressSummaryCard icon={HeartPulse} title="Bugünkü enerji" value={energyLabel} />
      </div>

      {strugglingTopic ? (
        <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
          <h2 className="text-base font-semibold text-panel-text">Gelişim alanı</h2>
          <p className="mt-1 text-base text-panel-text-muted">
            {strugglingTopic} konusunda tekrar ihtiyacı görünüyor.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
        <h2 className="text-base font-semibold text-panel-text">Motivasyon mesajı gönder</h2>
        <div className="mt-3 flex flex-col gap-2">
          {PARENT_MESSAGE_TEMPLATES.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => handleSendMessage(template)}
              className="rounded-xl border border-panel-border px-4 py-3 text-left text-base text-panel-text hover:bg-panel-bg"
            >
              {template}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            placeholder="Kendi mesajını yaz"
            className="flex-1 rounded-xl border border-panel-border p-3 text-base text-panel-text"
          />
          <button
            type="button"
            onClick={() => handleSendMessage(customText)}
            className="rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
          >
            Gönder
          </button>
        </div>
      </div>

      {recentMessages.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-panel-text">Son mesajlar</h2>
          {recentMessages.map((message) => (
            <ParentMessageCard key={message.id} message={message} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
