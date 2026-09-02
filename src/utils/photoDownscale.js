// Talep fotoğrafları (kapak / içindekiler / cevap anahtarı) için istemci tarafı
// küçültme. Kitap sayfası fotoğrafları okunaklı kalmalı, bu yüzden ResourceImageField'ın
// 512px kare kırpmasından farklı olarak: kırpma yok, en-boy oranı korunur, uzun kenar
// ~1600px'e indirilir ve JPEG'e çevrilir. Sonuç data URL'i doğrudan API'ye gönderilir.

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SOURCE_BYTES = 25 * 1024 * 1024
const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.82

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Görsel okunamadı.'))
    image.src = src
  })
}

/**
 * @param {File|Blob} file
 * @param {{ maxDimension?: number, quality?: number }} [options]
 * @returns {Promise<string>} data:image/jpeg;base64,...
 */
export async function downscalePhoto(file, options = {}) {
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION
  const quality = options.quality || DEFAULT_QUALITY

  if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('JPG, PNG veya WEBP görsel seçin.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Görsel çok büyük (en fazla 25 MB).')
  }

  const sourceUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) {
    throw new Error('Görsel okunamadı.')
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const outputWidth = Math.round(width * scale)
  const outputHeight = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, outputWidth, outputHeight)
  context.drawImage(image, 0, 0, width, height, 0, 0, outputWidth, outputHeight)

  return canvas.toDataURL('image/jpeg', quality)
}

/** Kopyala-yapıştır (clipboard) event'inden ilk görsel dosyasını döndürür. */
export function extractImageFromClipboard(event) {
  const items = event.clipboardData?.items
  if (!items) return null
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }
  return null
}
