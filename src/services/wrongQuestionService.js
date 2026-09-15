import { authRequest, cachedGet } from './authClient'

/**
 * @typedef {Object} WrongQuestion
 * @property {string} id
 * @property {string} [taskId]
 * @property {string} [testId]
 * @property {string} subject
 * @property {string} [topic] Ünitenin adı (ResourceBookTopics.name) — bkz. [topicName] testin kendi konusu için.
 * @property {string} [topicName] Testin kendi konusu (ResourceBookTopicTests.topic_name), ünite adından daha spesifik — ör. "Pozitif Tam Sayının Çarpanları".
 * @property {string} [testName]
 * @property {string} [bookName]
 * @property {string} [publisherName]
 * @property {string} [bookImageUrl]
 * @property {string} [questionNumber]
 * @property {number} [pageStart] Testin kaynak kitaptaki başlangıç sayfası (ResourceBookTopicTests.page_start).
 * @property {number} [pageEnd] Testin kaynak kitaptaki bitiş sayfası (ResourceBookTopicTests.page_end).
 * @property {string} errorType
 * @property {WrongQuestionAnalysisMap} [analyses] Rol bazlı hata analizi kulvarları (öğrenci / veli / öğretmen).
 * @property {string} createdAt
 * @property {string} reviewStatus  // 'tekrar-bekliyor' | 'bugun-tekrar' | 'tekrar-edildi' | 'ogrenildi'
 * @property {string|null} [resolvedAt]
 * @property {boolean} hasPhoto
 * @property {string} [photoUrl] Sadece foto kaydeden akışların döndürdüğü nesnelerde dolu gelir;
 * liste uçları (getWrongQuestions) performans için bunu hiç seçmez, bkz. getWrongQuestionPhoto.
 * @property {boolean} hasAnalysisPhoto "Hata Analiz" görseli eklenmiş mi — sadece veli ekler,
 * herkes görüntüler (öğrenci/veli/öğretmen). bkz. getWrongQuestionAnalysisPhoto.
 * @property {string} [analysisPhotoUrl] Sadece analiz görseli kaydeden akışların döndürdüğü
 * nesnelerde dolu gelir; liste uçları bunu hiç seçmez.
 */

/**
 * @typedef {Object} WrongQuestionAnalysis
 * @property {string} [mistakeReason] 'dikkat-hatasi' | 'bilgi-eksikligi' | 'soruyu-anlamadim'
 * @property {string} [note]
 * @property {string} [analyzedByName]
 */

/**
 * @typedef {Object} WrongQuestionAnalysisMap
 * @property {WrongQuestionAnalysis} [ogrenci]
 * @property {WrongQuestionAnalysis} [ebeveyn]
 * @property {WrongQuestionAnalysis} [ogretmen]
 */

/**
 * @typedef {Object} WrongQuestionTopicStats
 * @property {string} subject
 * @property {string} [topic]
 * @property {number} totalAnswered
 * @property {number|null} successRate
 */

/**
 * @typedef {Object} WrongQuestionSourceTopicStats
 * @property {string} subject
 * @property {string} [topic]
 * @property {string} [bookName]
 * @property {number} totalAnswered
 * @property {number|null} successRate
 */

/**
 * @typedef {Object} WrongQuestionSourceBookStats
 * @property {string} subject
 * @property {string} [bookName]
 * @property {number|null} completionRate Kitabın genel tamamlanma oranı (çözülen test / toplam test).
 */

/**
 * @typedef {Object} WrongQuestionTopicStatsResponse
 * @property {WrongQuestionTopicStats[]} topicStats İçerik grubuna göre (konudaki tüm kaynaklar birleşik).
 * @property {WrongQuestionSourceTopicStats[]} sourceTopicStats Kaynağa göre (her kitap için ayrı).
 * @property {WrongQuestionSourceBookStats[]} sourceBookStats Kaynağa göre kitap düzeyinde tamamlanma oranı.
 */

/**
 * @typedef {Object} WrongQuestionsResponse
 * @property {WrongQuestion[]} wrongQuestions
 * @property {Object<string, string>} bookImages Kitap adına göre kapak fotoğrafı (data URI);
 * her sorunun kendi bookImageUrl alanında taşınmaz — bkz. api/src/progress.js'deki
 * fetchWrongQuestionBookImagesByName yorumu (aynı görsel yüzlerce satırda tekrarlanmasın diye).
 */

/**
 * @param {string} [studentId] Veli oturumunda hangi çocuğun verisini isteyeceğini belirtir;
 * öğrenci kendi oturumunda görmezden gelinir. Backend zaten `?studentId=` ile sahiplik
 * kontrolü yapıp doğru öğrenciye yönlendiriyor (bkz. api/src/studentScope.js).
 * @returns {Promise<WrongQuestionsResponse>}
 */
export async function getWrongQuestions(studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await cachedGet(`/api/panel/wrong-questions${query}`)
  return { wrongQuestions: data.wrongQuestions || [], bookImages: data.bookImages || {} }
}

/** @param {string} [studentId] @returns {Promise<WrongQuestionTopicStatsResponse>} */
export async function getWrongQuestionTopicStats(studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await cachedGet(`/api/panel/wrong-question-topic-stats${query}`)
  return {
    topicStats: data.topicStats || [],
    sourceTopicStats: data.sourceTopicStats || [],
    sourceBookStats: data.sourceBookStats || [],
  }
}

/**
 * Bir sorunun tam base64 fotoğrafını tembel (lazy) çeker — galeri sadece o an gösterilen
 * fotoğraf için bunu çağırır, tüm listeyi tek seferde çekmenin getirdiği yavaşlığı önler.
 * @param {string} [studentId] @returns {Promise<string>} photoUrl
 */
export async function getWrongQuestionPhoto(id, studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await authRequest(`/api/panel/wrong-questions/${id}/photo${query}`, { method: 'GET' })
  return data.photoUrl
}

/**
 * Hata Defteri'ndeki bir sorunun fotoğrafını yenisiyle değiştirir (yanlış/okunmayan fotoğraf için).
 * Dönen nesne dolu `photoUrl` taşır — galeri tembel çekim yapmadan yeni fotoğrafı gösterebilir.
 * @param {string} photoDataUrl data:image/... base64
 * @param {string} [studentId]
 * @returns {Promise<WrongQuestion>}
 */
export async function updateWrongQuestionPhoto(id, photoDataUrl, studentId) {
  const body = studentId ? { photo: photoDataUrl, studentId } : { photo: photoDataUrl }
  const data = await authRequest(`/api/panel/wrong-questions/${id}/photo`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return data.wrongQuestion
}

/**
 * Bir sorunun Hata Analiz görselini tembel çeker (bkz. getWrongQuestionPhoto'daki aynı gerekçe).
 * @param {string} [studentId] @returns {Promise<string>} analysisPhotoUrl
 */
export async function getWrongQuestionAnalysisPhoto(id, studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await authRequest(`/api/panel/wrong-questions/${id}/analysis-photo${query}`, { method: 'GET' })
  return data.analysisPhotoUrl
}

/**
 * Hata Analiz görselini ekler/değiştirir. Sadece veli çağırabilir (backend 403 döner aksi halde).
 * @param {string} photoDataUrl data:image/... base64
 * @param {string} [studentId]
 * @returns {Promise<WrongQuestion>}
 */
export async function updateWrongQuestionAnalysisPhoto(id, photoDataUrl, studentId) {
  const body = studentId ? { photo: photoDataUrl, studentId } : { photo: photoDataUrl }
  const data = await authRequest(`/api/panel/wrong-questions/${id}/analysis-photo`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return data.wrongQuestion
}

/**
 * Hata Analiz görselini kaldırır. Sadece veli çağırabilir.
 * @param {string} [studentId]
 * @returns {Promise<WrongQuestion>}
 */
export async function deleteWrongQuestionAnalysisPhoto(id, studentId) {
  const body = studentId ? { studentId } : {}
  const data = await authRequest(`/api/panel/wrong-questions/${id}/analysis-photo`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
  return data.wrongQuestion
}

/**
 * "Hata Analizlerim" menüsü: Hata Analiz görseli eklenmiş tüm soruların YayınEvi/Kaynak/İçerik/
 * Test/Soru No listesi (görselin kendisi olmadan — tembel çekim, bkz. getWrongQuestionAnalysisPhoto).
 * @param {string} [studentId]
 * @returns {Promise<Array>}
 */
export async function getWrongQuestionAnalysisPhotos(studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await cachedGet(`/api/panel/wrong-question-analysis-photos${query}`)
  return data.items || []
}

/** @returns {Promise<WrongQuestion>} */
export async function addWrongQuestion(entry) {
  const data = await authRequest('/api/panel/wrong-questions', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
  return data.wrongQuestion
}

/** @param {string} [studentId] @returns {Promise<WrongQuestion>} */
export async function updateWrongQuestion(id, updates, studentId) {
  const body = studentId ? { ...updates, studentId } : updates
  const data = await authRequest(`/api/panel/wrong-questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return data.wrongQuestion
}
