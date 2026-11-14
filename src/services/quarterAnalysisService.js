import { authRequest } from './authClient'

/**
 * Veli "Çeyrek Dönem Analizi": çocuğun dersleri, öğretmenleri ve hata/analiz sayıları.
 * @returns {Promise<{studentFullName: string, subjects: Array}>}
 */
export async function getQuarterAnalysis(studentId) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  const data = await authRequest(`/api/panel/quarter-analysis${query}`, { method: 'GET' })
  return { studentFullName: data.studentFullName || '', subjects: data.subjects || [] }
}
