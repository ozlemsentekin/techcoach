import { useMemo, useState } from 'react'
import { readJSON, writeJSON } from '../../../services/storage'
import { getCoachNotes } from '../../../services/messageService'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { DAILY_COACH_MESSAGES, FEEL_GOOD_TIPS } from '../../../data/coachMessages'
import PageHeader from '../../layout/PageHeader'

function dailyMessage() {
  const dayIndex = new Date().getDate() % DAILY_COACH_MESSAGES.length
  return DAILY_COACH_MESSAGES[dayIndex]
}

export default function CoachPage() {
  const [smallGoal, setSmallGoal] = useState(() => readJSON('smallGoal', ''))
  const notes = useMemo(() => getCoachNotes(), [])
  const wrongQuestions = useMemo(() => getWrongQuestions(), [])

  const strugglingTopics = useMemo(() => {
    const counts = {}
    wrongQuestions.forEach((item) => {
      const key = item.topic ? `${item.subject} – ${item.topic}` : item.subject
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [wrongQuestions])

  const handleSmallGoalChange = (event) => {
    setSmallGoal(event.target.value)
    writeJSON('smallGoal', event.target.value)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Koçum" subtitle="Sana özel kısa yönlendirmeler burada." />

      <div className="rounded-2xl border border-panel-border bg-panel-lilac-soft p-5">
        <p className="text-sm font-medium text-panel-lilac">Bugünün mesajı</p>
        <p className="mt-1 text-base text-panel-text">{dailyMessage()}</p>
      </div>

      <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
        <h2 className="text-base font-semibold text-panel-text">Bana iyi gelenler</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {FEEL_GOOD_TIPS.map((tip) => (
            <li key={tip} className="text-sm text-panel-text-muted">
              · {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
        <h2 className="text-base font-semibold text-panel-text">Yardıma ihtiyacım var</h2>
        {notes.length === 0 ? (
          <p className="mt-2 text-sm text-panel-text-muted">
            Henüz bir not bırakmadın. "Şu an çok bunaldım" butonundan koçuna not bırakabilirsin.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id} className="text-sm text-panel-text-muted">
                {note.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {strugglingTopics.length > 0 ? (
        <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
          <h2 className="text-base font-semibold text-panel-text">Zorlandığın konular</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {strugglingTopics.map(([topic, count]) => (
              <li key={topic} className="text-sm text-panel-text-muted">
                {topic} · {count} soru
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
        <h2 className="text-base font-semibold text-panel-text">Küçük hedefim</h2>
        <textarea
          rows={2}
          value={smallGoal}
          onChange={handleSmallGoalChange}
          placeholder="Bu hafta kendine küçük bir hedef belirle"
          className="mt-2 w-full rounded-xl border border-panel-border p-3 text-base text-panel-text"
        />
      </div>
    </div>
  )
}
