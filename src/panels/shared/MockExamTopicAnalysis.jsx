import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Target } from 'lucide-react'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import { cn } from '../ui/utils'

// successRate eşiklerine göre durum rengi — MockExamsView'daki successTone rozetleriyle aynı
// eşikler, grafikte de aynı anlam korunsun diye (kırmızı/sarı/yeşil = zayıf/orta/güçlü konu).
function statusColor(successRate) {
  if (successRate >= 85) return 'var(--color-panel-green)'
  if (successRate >= 60) return 'var(--color-panel-yellow)'
  return 'var(--color-panel-red)'
}

function statusTone(successRate) {
  if (successRate >= 85) return 'bg-panel-green-soft text-panel-green'
  if (successRate >= 60) return 'bg-panel-yellow-soft text-panel-yellow'
  return 'bg-panel-red-soft text-panel-red'
}

function TopicTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-panel-text">{row.topic}</p>
      <p className="text-panel-text-muted">
        <span className="font-semibold text-panel-text">%{row.successRate}</span> başarı · {row.correct}D ·{' '}
        {row.wrong}Y · {row.blank}B ({row.total} soru)
      </p>
    </div>
  )
}

// Deneme sınavlarında soru bazlı girilen sorulardan (MockExamQuestions) türetilen ders → konu
// başarı grafiği + en çok hata yapılan konular listesi. Yalnızca "Soru bazlı gir" ile girilmiş
// sorulardan veri üretir; sadece toplam D/Y/B girilen denemeler bu analizde görünmez.
export default function MockExamTopicAnalysis({ fetchTopicStats }) {
  const [subjects, setSubjects] = useState(null)
  const [error, setError] = useState('')
  const [activeSubject, setActiveSubject] = useState(null)

  useEffect(() => {
    let ignore = false
    fetchTopicStats()
      .then((result) => {
        if (ignore) return
        setSubjects(result || [])
        setActiveSubject((current) => current || result?.[0]?.subjectName || null)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [fetchTopicStats])

  const activeSubjectData = useMemo(
    () => (subjects || []).find((s) => s.subjectName === activeSubject) || null,
    [subjects, activeSubject],
  )

  const mostMissed = useMemo(() => {
    if (!activeSubjectData) return []
    return [...activeSubjectData.topics]
      .filter((t) => t.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 8)
  }, [activeSubjectData])

  if (error) {
    return <div className="rounded-xl bg-panel-red-soft px-4 py-3 text-sm text-panel-red">{error}</div>
  }
  if (subjects === null) {
    return <LoadingState label="Konu analizi yükleniyor…" />
  }
  if (!subjects.length) {
    return (
      <EmptyState
        icon={Target}
        title="Konu bazlı veri yok"
        description="Bir deneme eklerken 'Soru bazlı gir' seçeneğini açıp her soruya konu yazdığında, konu analizini burada görebilirsin."
      />
    )
  }

  const axisTick = { fontSize: 10, fill: 'var(--color-panel-text-muted)' }
  const chartHeight = Math.max(160, (activeSubjectData?.topics.length || 1) * 34)

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-2">
          {subjects.map((s) => {
            const selected = s.subjectName === activeSubject
            return (
              <button
                key={s.subjectName}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveSubject(s.subjectName)}
                className={cn(
                  'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-panel-blue bg-panel-blue text-white shadow-sm'
                    : 'border-panel-border bg-panel-surface text-panel-text-muted hover:bg-panel-surface-soft',
                )}
              >
                {s.subjectName}
              </button>
            )
          })}
        </div>
      </div>

      {activeSubjectData ? (
        <>
          <div className="panel-card p-4">
            <p className="text-sm font-semibold text-panel-text">Konu bazında başarı</p>
            <p className="mt-0.5 text-xs text-panel-text-muted">
              {activeSubjectData.subjectName} — en zayıf konu üstte
            </p>
            <div className="mt-3 w-full" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeSubjectData.topics}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
                  barCategoryGap="28%"
                >
                  <XAxis type="number" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="topic"
                    width={140}
                    tick={{ fontSize: 11, fill: 'var(--color-panel-text)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: 'var(--color-panel-surface-soft)' }} content={<TopicTooltip />} />
                  <Bar dataKey="successRate" name="Başarı" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
                    {activeSubjectData.topics.map((t) => (
                      <Cell key={t.topic} fill={statusColor(t.successRate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel-card overflow-hidden">
            <p className="border-b border-panel-border px-4 py-3 text-sm font-semibold text-panel-text">
              En çok hata yapılan konular
            </p>
            {mostMissed.length ? (
              <ul className="divide-y divide-panel-border/60">
                {mostMissed.map((t) => (
                  <li key={t.topic} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="min-w-32 flex-1 text-sm font-medium text-panel-text">{t.topic}</span>
                    <span className="rounded-lg bg-panel-red-soft px-2 py-0.5 text-xs font-semibold text-panel-red tabular-nums">
                      {t.wrong} yanlış
                    </span>
                    <span className="rounded-lg bg-panel-surface-soft px-2 py-0.5 text-xs font-medium text-panel-text-muted tabular-nums">
                      {t.total} soru
                    </span>
                    <span className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums', statusTone(t.successRate))}>
                      %{t.successRate}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-panel-text-muted">Bu derste yanlış işaretlenmiş soru yok.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
