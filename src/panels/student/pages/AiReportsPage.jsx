import { useCallback } from 'react'
import PageHeader from '../../layout/PageHeader'
import AiReportsView from '../../shared/AiReportsView'
import { getAiReports, getAiReportScope, getAiReport, createAiReport } from '../../../services/aiAnalysisService'
import { getWrongQuestionPhoto, updateWrongQuestion } from '../../../services/wrongQuestionService'

export default function AiReportsPage() {
  const fetchReports = useCallback(() => getAiReports(), [])
  const fetchScope = useCallback((subject) => getAiReportScope(subject), [])
  const fetchReportDetail = useCallback((id) => getAiReport(id), [])
  const createReport = useCallback((payload) => createAiReport(payload), [])
  const fetchPhoto = useCallback((id) => getWrongQuestionPhoto(id), [])
  const updateMistakeAnalysis = useCallback((id, analysis) => updateWrongQuestion(id, { analysis }), [])
  const updateMistakeMeta = useCallback((id, updates) => updateWrongQuestion(id, updates), [])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="AI Raporları" subtitle="Hata görsellerinden oluşturulan konu-eksiği analizleri." />
      <AiReportsView
        fetchReports={fetchReports}
        fetchScope={fetchScope}
        fetchReportDetail={fetchReportDetail}
        createReport={createReport}
        fetchPhoto={fetchPhoto}
        updateMistakeAnalysis={updateMistakeAnalysis}
        updateMistakeMeta={updateMistakeMeta}
        viewerRole="ogrenci"
        canCreate
      />
    </div>
  )
}
