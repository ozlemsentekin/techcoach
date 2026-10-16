// Göreve eklenen dosya: resim veya PDF, base64 data URL (bkz. api/src/tasks.js sanitizeTaskAttachment).
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
export const ATTACHMENT_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
// Bir göreve en fazla 5 dosya, toplam 15 MB (bkz. api/src/tasks.js sanitizeTaskAttachments).
export const MAX_ATTACHMENT_COUNT = 5
export const MAX_ATTACHMENTS_TOTAL_BYTES = 15 * 1024 * 1024

/** Görevin ek listesi; eski tekil attachmentUrl alanı da desteklenir. @returns {{ url: string, name: string }[]} */
export function getTaskAttachments(task) {
  if (Array.isArray(task?.attachments)) return task.attachments.filter((item) => item?.url)
  return task?.attachmentUrl ? [{ url: task.attachmentUrl, name: task.attachmentName || 'ek-dosya' }] : []
}

// data URL'nin yaklaşık bayt karşılığı (base64 ≈ 4/3).
export function attachmentBytes(attachment) {
  const base64 = attachment?.url?.split(',')[1] || ''
  return Math.floor((base64.length * 3) / 4)
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Seçilen dosyayı doğrular ve data URL'ye çevirir.
 * @returns {Promise<{ url: string, name: string } | { error: string }>}
 */
export async function pickAttachment(file) {
  if (!file) return { error: 'Dosya seçilmedi.' }
  if (!ATTACHMENT_ALLOWED_TYPES.has(file.type)) {
    return { error: 'Yalnızca JPG, PNG, WEBP veya PDF dosyası ekleyebilirsiniz.' }
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: 'Dosya çok büyük. En fazla 5 MB olabilir.' }
  }
  try {
    const url = await readFileAsDataUrl(file)
    return { url, name: file.name }
  } catch (err) {
    return { error: err.message || 'Dosya okunamadı.' }
  }
}
