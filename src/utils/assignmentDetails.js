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
    const testGroups = []

    dashLines.forEach((line) => {
      const clean = line.replace(/^-\s*/, '')
      const separatorIndex = clean.indexOf(':')
      if (separatorIndex === -1) {
        const topic = clean.trim()
        topics.push(topic)
        testGroups.push({ topic, testName: null })
      } else {
        const topic = clean.slice(0, separatorIndex).trim()
        const testName = clean.slice(separatorIndex + 1).trim()
        topics.push(topic)
        if (testName) testNames.push(testName)
        testGroups.push({ topic, testName: testName || null })
      }
    })

    return {
      kaynak,
      testTopic: topics.join(', ') || null,
      testName: testNames.join(', ') || null,
      testGroups,
      rawText: null,
    }
  }

  return {
    // Okul Ödevi'nde kaynak, okul+sınıf+ders bazlı okul kaynağıdır (SchoolClassResources).
    kaynak: task.schoolResourceName || null,
    testTopic: task.topic || null,
    testName: null,
    testGroups: [],
    rawText: description || null,
  }
}
