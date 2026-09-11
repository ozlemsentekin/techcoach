import { authRequest, cachedGet } from './authClient'

// AI Raporları — bir öğrencinin Hata Defteri'ndeki hata görsellerinden üretilen konu-eksiği
// analizleri. Veli oturumunda `studentId` ile hangi çocuğun verisi istendiği belirtilir;
// öğrenci kendi oturumunda görmezden gelinir (backend sahiplik kontrolü yapar).

// Azure SWA'nın managed functions API'si dokümante edilmemiş ama gerçek bir ~100 sn'lik sert HTTP
// zaman aşımına sahip (bkz. api/src/aiAnalysis.js MAX_IMAGES yorumu) — bu istemci zaman aşımı
// normalde ondan önce hiç tetiklenmez, sadece platform beklenenden farklı davranırsa son çare.
const REPORT_CREATE_TIMEOUT_MS = 220000

function withStudent(path, studentId) {
  if (!studentId) return path
  return `${path}${path.includes('?') ? '&' : '?'}studentId=${studentId}`
}

/** @returns {Promise<{ reports: object[], availableSubjects: {subject:string, questionCount:number}[] }>} */
export async function getAiReports(studentId) {
  const data = await cachedGet(withStudent('/api/panel/ai-analysis-reports', studentId))
  return { reports: data.reports || [], availableSubjects: data.availableSubjects || [] }
}

/**
 * Bir derste hata görseli olan, henüz analiz edilmemiş TÜM sorular (tarih/içerik filtreleri
 * istemci tarafında uygulanır — bkz. AiReportsView.jsx CreateReportModal).
 * @returns {Promise<{ questions: {id:string, questionNumber?:string, topic:string, bookName?:string,
 *   publisherName?:string, testName?:string, correctAnswer?:string, createdAt:string}[] }>}
 */
export async function getAiReportScope(subject, studentId) {
  const path = withStudent(`/api/panel/ai-analysis-scope?subject=${encodeURIComponent(subject)}`, studentId)
  const data = await cachedGet(path)
  return { questions: data.questions || [] }
}

/** @returns {Promise<object>} rapor detayı (report + wrongQuestions) */
export async function getAiReport(reportId, studentId) {
  const data = await authRequest(withStudent(`/api/panel/ai-analysis-reports/${reportId}`, studentId), {
    method: 'GET',
  })
  return data.report
}

/** @returns {Promise<object>} oluşturulan rapor detayı */
export async function createAiReport({ subject, wrongQuestionIds }, studentId) {
  const body = studentId ? { subject, wrongQuestionIds, studentId } : { subject, wrongQuestionIds }
  const data = await authRequest('/api/panel/ai-analysis-reports', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: REPORT_CREATE_TIMEOUT_MS,
  })
  return data.report
}

/** Bir yanlış sorunun tam base64 fotoğrafını tembel çeker (galeri için). */
export async function getAiReportWrongQuestionPhoto(id, studentId) {
  const data = await authRequest(withStudent(`/api/panel/wrong-questions/${id}/photo`, studentId), {
    method: 'GET',
  })
  return data.photoUrl
}
