import { useEffect, useState } from 'react'
import { FileCheck2 } from 'lucide-react'
import { getSessions } from '../../../services/studySessionService'
import { getTasksForDate } from '../../../services/taskService'
import { calculateNet } from '../../../utils/netCalculator'
import { todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Badge from '../../ui/Badge'
import DataTable from '../../ui/DataTable'

function TestSessionCard({ session }) {
  const title = session.task?.subject || session.task?.title || 'Çalışma Oturumu'
  const date = new Date(session.endedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  const metrics = [
    { label: 'Doğru', value: session.correctCount, tone: 'bg-panel-sage-soft text-panel-sage' },
    { label: 'Yanlış', value: session.wrongCount, tone: 'bg-panel-red-soft text-panel-red' },
    { label: 'Boş', value: session.blankCount, tone: 'bg-panel-surface-soft text-panel-text-muted' },
  ]

  return (
    <article className="rounded-xl border border-panel-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-sm font-bold leading-snug text-[#253d3e]">{title}</h2>
          <p className="mt-1 text-xs font-medium text-[#667475]">{date}</p>
          {session.difficultyRating ? (
            <p className="mt-1 text-xs text-[#667475]">Zorluk: {session.difficultyRating}</p>
          ) : null}
        </div>
        <Badge tone="blue">{calculateNet(session.correctCount, session.wrongCount)} net</Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {metrics.map((item) => (
          <div key={item.label} className={`rounded-lg px-2 py-2 text-center ${item.tone}`}>
            <p className="text-lg font-bold leading-none tabular-nums">{item.value}</p>
            <p className="mt-1 text-[11px] font-semibold">{item.label}</p>
          </div>
        ))}
      </div>
    </article>
  )
}

export default function TestsPage() {
  const [testSessions, setTestSessions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    Promise.all([getTasksForDate(todayISODate()), getSessions()])
      .then(([tasks, allSessions]) => {
        if (ignore) return
        const tasksById = Object.fromEntries(tasks.map((task) => [task.id, task]))
        const sessions = allSessions
          .filter((session) => session.correctCount !== undefined)
          .map((session) => ({ ...session, task: tasksById[session.taskId] }))
          .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
        setTestSessions(sessions)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }

  if (testSessions === null) {
    return <LoadingState label="Test sonuçları yükleniyor..." />
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Test ve Denemeler" />

      {testSessions.length === 0 ? (
        <EmptyState icon={FileCheck2} title="Henüz test sonucu yok" description="Aylin bir test tamamladığında burada görünecek." />
      ) : (
        <div className="fade-slide-in">
          <div className="grid gap-3 md:hidden">
            {testSessions.map((session) => (
              <TestSessionCard key={session.id} session={session} />
            ))}
          </div>

          <DataTable className="hidden md:block">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#1c2b5e]">
                  <th className="px-4 py-3">Ders</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3 text-center">Doğru</th>
                  <th className="px-4 py-3 text-center">Yanlış</th>
                  <th className="px-4 py-3 text-center">Boş</th>
                  <th className="px-4 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f1]">
                {testSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-[#f8f7fb]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#253d3e]">
                        {session.task?.subject || session.task?.title || 'Çalışma Oturumu'}
                      </p>
                      {session.difficultyRating ? (
                        <p className="text-xs text-[#667475]">Zorluk: {session.difficultyRating}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                      {new Date(session.endedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-[#667475]">{session.correctCount}</td>
                    <td className="px-4 py-3 text-center text-sm text-[#667475]">{session.wrongCount}</td>
                    <td className="px-4 py-3 text-center text-sm text-[#667475]">{session.blankCount}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone="blue">{calculateNet(session.correctCount, session.wrongCount)} net</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </div>
      )}
    </div>
  )
}
