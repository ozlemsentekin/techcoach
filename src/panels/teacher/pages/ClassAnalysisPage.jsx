import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GraduationCap, Target, Users } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import { buildActivityRecords, formatNumber } from '../../shared/progressAnalytics'
import { RATE_TONES } from '../../shared/rateTones'
import { cn } from '../../ui/utils'
import { todayISODate } from '../../../utils/time'
import { getTeacherClassAnalysis } from '../../../services/teacherService'
import { useTeacherClasses } from '../useTeacherClasses'
import { AnalysisBody, SummaryMetric } from '../../shared/analysisView'
import { SORTS, analyzeEntity, buildAnalysis, pct, toneFor } from '../../shared/analysisData'

const UNSPECIFIED_KEY = '__none__'

export default function ClassAnalysisPage() {
  const navigate = useNavigate()
  const { grades, hasUnspecified, classesLoading } = useTeacherClasses()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loaded, setLoaded] = useState(null)
  const [failed, setFailed] = useState(null)
  const [sortKey, setSortKey] = useState('accuracyAsc')
  const today = useMemo(() => todayISODate(), [])

  const tabs = useMemo(() => {
    const list = grades.map((grade) => ({ key: String(grade), label: `${grade}. Sınıf` }))
    if (hasUnspecified) list.push({ key: UNSPECIFIED_KEY, label: 'Sınıf belirtilmemiş' })
    return list
  }, [grades, hasUnspecified])

  const gradeParam = searchParams.get('grade')
  const activeKey = tabs.some((tab) => tab.key === gradeParam) ? gradeParam : tabs[0]?.key || null

  const openStudent = useCallback((id) => navigate(`/teacher/students/${id}?tab=analysis`), [navigate])

  useEffect(() => {
    if (!activeKey) return undefined
    let ignore = false
    getTeacherClassAnalysis(activeKey)
      .then((result) => {
        if (!ignore) setLoaded({ key: activeKey, result })
      })
      .catch((err) => {
        if (!ignore) setFailed({ key: activeKey, message: err.message })
      })
    return () => {
      ignore = true
    }
  }, [activeKey])

  // Sekme değişince eski sınıfın verisi ekranda kalmasın.
  const data = loaded?.key === activeKey ? loaded.result : null
  const error = failed?.key === activeKey ? failed.message : ''

  const analysis = useMemo(() => {
    if (!data) return null
    const entities = (data.students || []).map((entry) => {
      const overview = entry.overview || {}
      const testsById = new Map((overview.tests || []).map((test) => [test.id, test]))
      return analyzeEntity({
        key: entry.studentTeacherId,
        name: entry.studentFullName,
        records: buildActivityRecords(overview, testsById),
        tasks: overview.tasks || [],
        overview,
        subjectName: entry.subjectName || null,
        lastActivityAt: entry.lastActivityAt || null,
      })
    })
    return buildAnalysis(entities, today)
  }, [data, today])

  const sortedStudents = useMemo(() => {
    if (!analysis) return []
    return [...analysis.entities].sort(SORTS[sortKey].fn)
  }, [analysis, sortKey])

  if (classesLoading && !tabs.length) {
    return <LoadingState label="Sınıflar yükleniyor..." />
  }

  if (!tabs.length) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Sınıf Analizi" subtitle="Sınıf düzeyinde toplu öğrenci analizi." />
        <EmptyState
          icon={GraduationCap}
          title="Henüz sınıf oluşmadı"
          description="Aktif öğrencilerinizin profilinde sınıf bilgisi girildiğinde sınıflar burada sekme olarak görünür."
        />
      </div>
    )
  }

  const activeTab = tabs.find((tab) => tab.key === activeKey)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Sınıf Analizi" subtitle="Sınıftaki her öğrencinin durumunu tek ekranda karşılaştırın." />

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-2">
          {tabs.map((tab) => {
            const selected = tab.key === activeKey
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setSearchParams({ grade: tab.key }, { replace: true })}
                className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-panel-blue bg-panel-blue text-white shadow-sm'
                    : 'border-panel-border bg-panel-surface text-panel-text-muted hover:bg-panel-surface-soft'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {analysis ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <SummaryMetric
            icon={Users}
            iconClassName="bg-panel-blue-soft text-panel-blue"
            title="Sınıf Mevcudu"
            value={formatNumber(analysis.summary.count)}
            description={`${formatNumber(analysis.summary.activeCount)} öğrenci aktif çözüm yaptı`}
          />
          <SummaryMetric
            icon={Target}
            iconClassName={cn('bg-panel-blue-soft', RATE_TONES[toneFor(analysis.summary.avgAccuracy)].text)}
            valueClassName={
              Number.isFinite(analysis.summary.avgAccuracy)
                ? RATE_TONES[toneFor(analysis.summary.avgAccuracy)].text
                : undefined
            }
            title="Sınıf Başarı Ortalaması"
            value={pct(analysis.summary.avgAccuracy)}
            description={
              analysis.summary.activeCount
                ? `${analysis.summary.activeCount} öğrenci · %${Math.round(analysis.summary.minAccuracy)}–%${Math.round(
                    analysis.summary.maxAccuracy,
                  )} arası`
                : 'Henüz çözüm yok'
            }
          />
        </div>
      ) : null}

      {data?.failedStudents?.length ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
          {data.failedStudents.length} öğrencinin verisi yüklenemedi ({data.failedStudents.join(', ')}); kalan öğrenciler
          aşağıda gösteriliyor.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : !analysis ? (
        <LoadingState label={`${activeTab?.label || 'Sınıf'} analizi yükleniyor...`} />
      ) : analysis.entities.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Bu sınıfta öğrenci yok"
          description="Seçili sınıfa atanmış aktif öğrenciniz bulunmuyor."
        />
      ) : (
        <AnalysisBody
          analysis={analysis}
          sortedEntities={sortedStudents}
          sortKey={sortKey}
          onSortChange={setSortKey}
          onSelect={openStudent}
        />
      )}
    </div>
  )
}
