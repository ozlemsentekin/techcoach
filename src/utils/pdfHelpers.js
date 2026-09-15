import { ROBOTO_REGULAR_TTF_BASE64, ROBOTO_BOLD_TTF_BASE64 } from './fonts/robotoTurkish'

// jsPDF'in yerleşik (Helvetica vb.) fontları WinAnsi encoding kullanıyor ve Türkçe'ye özgü
// ı/İ/ş/ğ karakterlerini içermiyor (ör. "İfadeler" "0fadeler" olarak basılıyordu). Bunu çözmek
// için Latin + Türkçe karakter setine subsetlenmiş bir Roboto TTF'i (bkz. fonts/robotoTurkish.js,
// yaklaşık 20KB/ağırlık) gömüp varsayılan font yerine kullanıyoruz. Hem wrongQuestionsPdf.js hem
// analysisPhotosPdf.js aynı PDF'leri ürettiği için bu yardımcılar ortak dosyada tutulur.
export function registerTurkishFont(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_TTF_BASE64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_TTF_BASE64)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
}

export function detectImageFormat(dataUrl) {
  const match = /^data:image\/(\w+);base64,/i.exec(dataUrl || '')
  const type = (match?.[1] || 'jpeg').toLowerCase()
  return type === 'png' ? 'PNG' : 'JPEG'
}

export function loadImageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 })
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

export function slugifyForFileName(value) {
  return (value || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
