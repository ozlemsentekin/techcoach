/**
 * Ödev notu, öğrencinin "Ödev Ekle" akışında şu formatta üretilir (bkz. AddHomeworkModal):
 *   Kaynak Kitap Adı
 *   - Konu Adı: Test 1, Test 2, ...
 * Bu fonksiyon o formatı ayrıştırıp Kaynak / Test Konusu / Test Adı alanlarına böler.
 * Format eşleşmezse (elle yazılmış serbest metin gibi) tüm metni ham içerik olarak döner.
 */
export function parseAssignmentDetails(task) {
  const description = task.description || ''
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const dashLines = lines.filter((line) => line.startsWith('-'))

  if (lines.length > 1 && dashLines.length > 0) {
    const kaynak = lines[0]
    const topics = []
    const testNames = []

    dashLines.forEach((line) => {
      const clean = line.replace(/^-\s*/, '')
      const separatorIndex = clean.indexOf(':')
      if (separatorIndex === -1) {
        topics.push(clean)
      } else {
        topics.push(clean.slice(0, separatorIndex).trim())
        testNames.push(clean.slice(separatorIndex + 1).trim())
      }
    })

    return {
      kaynak,
      testTopic: topics.join(', ') || null,
      testName: testNames.join(', ') || null,
      rawText: null,
    }
  }

  return {
    kaynak: null,
    testTopic: task.topic || null,
    testName: null,
    rawText: description || null,
  }
}
