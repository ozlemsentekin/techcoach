const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_TEACHER_SUBJECTS = 20

function isGuid(value) {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}

function normalizeTeacherSubjectIds(value) {
  if (value === undefined || value === null) {
    return { value: [] }
  }
  if (!Array.isArray(value)) {
    return { error: 'Branş listesi geçersiz.' }
  }
  if (value.length > MAX_TEACHER_SUBJECTS) {
    return { error: `En fazla ${MAX_TEACHER_SUBJECTS} branş seçebilirsiniz.` }
  }

  const ids = []
  const seen = new Set()
  for (const raw of value) {
    if (!isGuid(raw)) {
      return { error: 'Branş listesi geçersiz.' }
    }
    const id = raw.trim().toLowerCase()
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  return { value: ids }
}

function parseTeacherSubjectIdsJson(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

module.exports = { normalizeTeacherSubjectIds, parseTeacherSubjectIdsJson }
