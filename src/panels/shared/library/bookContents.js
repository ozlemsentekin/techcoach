// Kaynağa eklenmiş içerikleri (aynı adlı satırları birleştirerek) başlangıç sayfasına göre
// sıralı bir "İçindekiler" listesine dönüştürür. Bir içeriğin başlangıç sayfası, o içeriğe
// bağlı testlerin en küçük başlangıç sayfasıdır; hiç testi yoksa sayfa bilinmiyor demektir.
// bookTopics / bookTests bu kaynağa göre önceden filtrelenmiş olarak beklenir.
export function buildBookContents(bookTopics, bookTests) {
  const groups = new Map()
  bookTopics.forEach((topic) => {
    const existing = groups.get(topic.name)
    if (existing) existing.topicIds.push(topic.id)
    else groups.set(topic.name, { name: topic.name, topicIds: [topic.id] })
  })

  const entries = Array.from(groups.values()).map((group) => {
    const groupTests = bookTests.filter((test) => group.topicIds.includes(test.topicId))
    const pages = groupTests
      .map((test) => Number(test.pageStart))
      .filter((page) => Number.isInteger(page) && page > 0)
    return {
      name: group.name,
      topicIds: group.topicIds,
      testCount: groupTests.length,
      page: pages.length ? Math.min(...pages) : null,
    }
  })

  entries.sort((a, b) => {
    if (a.page == null && b.page == null) return a.name.localeCompare(b.name, 'tr')
    if (a.page == null) return 1
    if (b.page == null) return -1
    return a.page - b.page
  })

  return entries
}
