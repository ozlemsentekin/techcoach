import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import { buildGrowthSentences } from './mockExamGrowthText'

// Deneme Sınavları → "Deneme Gelişimi": zaman içinde tekrar eden sınav deneyimlerini
// (duygu, dikkat/süre/optik durumları, önceki hedefin uygulanması) deterministik cümlelerle
// gösterir — MockExamTopicAnalysis'in fetch + LoadingState/EmptyState kalıbını izler.
// AI yorumu yok; her cümle backend'deki ham sayımdan (computeMockExamGrowthSummary)
// doğrudan türetilir.
export default function MockExamGrowthSummary({ fetchGrowthSummary, canEditExperience }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    fetchGrowthSummary()
      .then((result) => {
        if (!ignore) setSummary(result)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [fetchGrowthSummary])

  if (error) {
    return <div className="rounded-xl bg-panel-red-soft px-4 py-3 text-sm text-panel-red">{error}</div>
  }
  if (summary === null) {
    return <LoadingState label="Deneme gelişimi yükleniyor…" />
  }

  const sentences = buildGrowthSentences(summary, { audience: canEditExperience ? 'self' : 'other' })

  if (summary.examCount < summary.minExams || !sentences.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Henüz yeterli veri yok"
        description={`Deneme gelişimini görebilmek için en az ${summary.minExams} denemede "Sınav Deneyimi" bölümünün doldurulmuş olması gerekiyor.`}
      />
    )
  }

  return (
    <div className="panel-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
          <TrendingUp size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-panel-text">Denemelerden Öğrendiklerim</p>
          <p className="text-xs text-panel-text-muted">Son {summary.examCount} denemenin deneyim özeti.</p>
        </div>
      </div>
      <ul className="divide-y divide-panel-border/60">
        {sentences.map((sentence, index) => (
          <li key={index} className="px-4 py-3 text-sm text-panel-text">
            {sentence}
          </li>
        ))}
      </ul>
    </div>
  )
}
