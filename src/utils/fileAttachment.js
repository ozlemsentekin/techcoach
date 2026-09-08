// Göreve eklenen dosya: resim veya PDF, base64 data URL (bkz. api/src/tasks.js sanitizeTaskAttachment).
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
export const ATTACHMENT_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

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
