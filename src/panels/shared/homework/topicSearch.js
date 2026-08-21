function normalizeText(value) {
  return String(value ?? '').toLocaleLowerCase('tr-TR')
}

function pageRangeMatches(test, query) {
  const pageStart = Number(test.pageStart)
  const pageEnd = Number(test.pageEnd)
  const pageQuery = Number(query)
  const hasPageRange = Number.isFinite(pageStart) && Number.isFinite(pageEnd)

  if (/^\d+$/.test(query) && Number.isFinite(pageQuery) && hasPageRange) {
    return pageStart <= pageQuery && pageQuery <= pageEnd
  }

  return [
    test.pageStart,
    test.pageEnd,
    hasPageRange ? `${pageStart}-${pageEnd}` : '',
    hasPageRange ? `s.${pageStart}-${pageEnd}` : '',
    hasPageRange ? `sayfa ${pageStart}-${pageEnd}` : '',
  ].some((value) => normalizeText(value).includes(query))
}

function testMatchesSearch(test, query) {
  return (
    normalizeText(test.name).includes(query) ||
    normalizeText(test.topicName).includes(query) ||
    normalizeText(test.questionCount).includes(query) ||
    pageRangeMatches(test, query)
  )
}

export function filterTopicsBySearch(topics, query) {
  const trimmed = query.trim()
  if (!trimmed) return topics

  const normalizedQuery = normalizeText(trimmed)
  return topics
    .map((topic) => {
      const topicMatches = normalizeText(topic.name).includes(normalizedQuery)
      const tests = topicMatches ? topic.tests : topic.tests.filter((test) => testMatchesSearch(test, normalizedQuery))
      if (!topicMatches && tests.length === 0) return null
      return { ...topic, tests }
    })
    .filter(Boolean)
}
