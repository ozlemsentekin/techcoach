// Bir görseli (URL) verilen açıyla (90'ın katı) döndürüp JPEG data URL'si döner — Hata Analizi
// slaytında yan çekilmiş soru fotoğrafını kalıcı düzeltmek için. Görsel CORS ile (blob depo
// techcoach.com.tr'ye izin veriyor) indirilir, böylece canvas "kirlenmez". Uzun kenar
// MAX_DIMENSION'a indirilir ve sunucunun 5 MB sınırına sığana kadar kalite düşürülür.
const MAX_DIMENSION = 2400
const MAX_DATA_URL_LENGTH = Math.floor((4.5 * 1024 * 1024 * 4) / 3)

export async function rotateImageToDataUrl(url, degrees) {
  const response = await fetch(url, { mode: 'cors', cache: 'no-store' })
  if (!response.ok) throw new Error('Fotoğraf indirilemedi.')
  const bitmap = await createImageBitmap(await response.blob())

  const angle = ((degrees % 360) + 360) % 360
  const sideways = angle === 90 || angle === 270
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = sideways ? height : width
  canvas.height = sideways ? width : height
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((angle * Math.PI) / 180)
  context.drawImage(bitmap, -width / 2, -height / 2, width, height)
  bitmap.close?.()

  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl
  }
  throw new Error('Döndürülen fotoğraf çok büyük.')
}
