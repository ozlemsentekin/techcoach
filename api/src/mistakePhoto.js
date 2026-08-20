const MAX_MISTAKE_PHOTO_MB = 5
const MAX_MISTAKE_PHOTO_LENGTH = Math.ceil((MAX_MISTAKE_PHOTO_MB * 1024 * 1024 * 4) / 3)
const MISTAKE_PHOTO_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i

function sanitizeMistakePhoto(value) {
  const photo = typeof value === 'string' ? value.trim() : ''
  if (!photo) return { error: 'Fotoğraf zorunludur.' }
  if (photo.length > MAX_MISTAKE_PHOTO_LENGTH) {
    return { error: `Fotoğraf çok büyük. En fazla ${MAX_MISTAKE_PHOTO_MB} MB olabilir, daha küçük bir görsel seçin.` }
  }
  if (!MISTAKE_PHOTO_DATA_URL_PATTERN.test(photo)) {
    return { error: 'Geçerli bir JPG/PNG/WEBP fotoğrafı yükleyin.' }
  }
  return { value: photo }
}

const WRONG_QUESTION_OUTPUT_COLUMNS = `
  inserted.id, inserted.student_id, inserted.task_id, inserted.test_id, inserted.subject, inserted.topic,
  inserted.test_name, inserted.book_name, inserted.publisher_name, inserted.question_number,
  inserted.error_type, inserted.student_note, inserted.mistake_reason, inserted.review_status, inserted.resolved_at,
  inserted.photo_url, inserted.created_at
`

module.exports = { sanitizeMistakePhoto, WRONG_QUESTION_OUTPUT_COLUMNS }
