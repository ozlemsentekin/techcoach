import { useEffect, useMemo, useState } from 'react'
import { Award, X } from 'lucide-react'
import { getProgressOverview } from '../../../services/progressService'
import { calculateNet } from '../../../utils/netCalculator'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'

const collator = new Intl.Collator('tr-TR')
const numberFormatter = new Intl.NumberFormat('tr-TR')

function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(asNumber(value)))
}

function formatNet(value) {
  return numberFormatter.format(Math.round(asNumber(value) * 100) / 100)
}

function formatPercent(correct, wrong) {
  const answered = asNumber(correct) + asNumber(wrong)
  if (answered <= 0) return '—'
  return `%${numberFormatter.format(Math.round((asNumber(correct) / answered) * 100))}`
}

function buildSubjectReportRows(overview) {
  const subjects = new Map()

  const ensureSubject = (subjectId, subjectName) => {
    const key = subjectId || subjectName || 'no-subject'
    if (!subjects.has(key)) {
      subjects.set(key, {
        key,
        name: subjectName || 'Derssiz Kaynaklar',
        questions: 0,
        correct: 0,
        wrong: 0,
        blank: 0,
      })
    }
    return subjects.get(key)
  }

  ;(overview.resourceBooks || []).forEach((book) => ensureSubject(book.subjectId, book.subjectName))

  const addQuestionBankStats = (item) => {
    if (item.resourceType !== 'soru_bankasi') return
    const bucket = ensureSubject(item.subjectId, item.subjectName)

    const testEntries = Object.entries(item.testResults || {})
    if (testEntries.length) {
      testEntries.forEach(([, result]) => {
        const correct = asNumber(result?.correct)
        const wrong = asNumber(result?.wrong)
        const blank = asNumber(result?.blank)
        bucket.correct += correct
        bucket.wrong += wrong
        bucket.blank += blank
        bucket.questions += correct + wrong + blank
      })
      return
    }

    const correct = asNumber(item.correctCount)
    const wrong = asNumber(item.wrongCount)
    const blank = asNumber(item.blankCount)
    const questions = asNumber(item.completedQuestionCount)
    bucket.correct += correct
    bucket.wrong += wrong
    bucket.blank += blank
    bucket.questions += questions > 0 ? questions : correct + wrong + blank
  }

  const taskIdsWithSessions = new Set()
  ;(overview.sessions || []).forEach((session) => {
    if (session.taskId) taskIdsWithSessions.add(session.taskId)
    addQuestionBankStats(session)
  })

  ;(overview.tasks || []).forEach((task) => {
    if (taskIdsWithSessions.has(task.id)) return
    addQuestionBankStats(task)
  })

  return Array.from(subjects.values())
    .map((bucket) => ({ ...bucket, net: calculateNet(bucket.correct, bucket.wrong) }))
    .sort((a, b) => collator.compare(a.name, b.name))
}

export default function StudentReportCardModal({ student, onClose }) {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    getProgressOverview(student.id)
      .then((data) => {
        if (!ignore) setOverview(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id])

  const rows = useMemo(() => (overview ? buildSubjectReportRows(overview) : []), [overview])

  const totals = useMemo(
    () =>
      rows.reduce(
        (total, row) => ({
          questions: total.questions + row.questions,
          correct: total.correct + row.correct,
          wrong: total.wrong + row.wrong,
          blank: total.blank + row.blank,
        }),
        { questions: 0, correct: 0, wrong: 0, blank: 0 },
      ),
    [rows],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-panel-2">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf0f1] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">LGS Karnesi</h2>
            <p className="text-sm text-panel-text-muted">{student.fullName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {overview === null ? (
            <LoadingState label="Karne yükleniyor..." />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Henüz ders yok"
              description="Bu öğrenciye henüz kaynak atanmamış."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#edf0f1]">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#1c2b5e]">
                    <th className="px-4 py-3">Ders</th>
                    <th className="px-4 py-3 text-right">Toplam Soru</th>
                    <th className="px-4 py-3 text-right">Doğru</th>
                    <th className="px-4 py-3 text-right">Yanlış</th>
                    <th className="px-4 py-3 text-right">Boş</th>
                    <th className="px-4 py-3 text-right">Net</th>
                    <th className="px-4 py-3 text-right">Yüzde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f1]">
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-3 text-sm font-semibold text-[#253d3e]">{row.name}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#667475]">{formatNumber(row.questions)}</td>
                      <td className="px-4 py-3 text-right text-sm text-panel-sage">{formatNumber(row.correct)}</td>
                      <td className="px-4 py-3 text-right text-sm text-panel-red">{formatNumber(row.wrong)}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#667475]">{formatNumber(row.blank)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#1c2b5e]">{formatNet(row.net)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#253d3e]">
                        {formatPercent(row.correct, row.wrong)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#edf0f1] bg-[#f8f7fb]">
                    <td className="px-4 py-3 text-sm font-bold text-[#253d3e]">Toplam</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#253d3e]">{formatNumber(totals.questions)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-panel-sage">{formatNumber(totals.correct)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-panel-red">{formatNumber(totals.wrong)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#667475]">{formatNumber(totals.blank)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#1c2b5e]">
                      {formatNet(calculateNet(totals.correct, totals.wrong))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#253d3e]">
                      {formatPercent(totals.correct, totals.wrong)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
