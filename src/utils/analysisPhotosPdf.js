import jsPDF from 'jspdf'
import { registerTurkishFont, detectImageFormat, loadImageSize, slugifyForFileName } from './pdfHelpers'

const PAGE_MARGIN = 12

// Hata Analiz galerisindeki (AnalysisPhotoViewer.jsx) görselleri yazdırma/indirme için PDF'e
// dönüştürür — her görsel kendi sayfasında, üstte başlık (soru bağlamı) ve altta "n / toplam"
// ile. wrongQuestionsPdf.js'deki soru fotoğrafı PDF'inden farklı olarak burada tek bir sorunun
// (genelde 1-5) analiz görseli var, bu yüzden ızgara değil tam sayfa görsel kullanılır.
export async function buildAnalysisPhotosPdf({ title, subtitle, photos }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerTurkishFont(doc)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let i = 0; i < photos.length; i += 1) {
    if (i > 0) doc.addPage()

    doc.setFont('Roboto', 'bold')
    doc.setFontSize(13)
    doc.text(title || 'Hata Analiz', PAGE_MARGIN, PAGE_MARGIN + 5, { maxWidth: pageWidth - PAGE_MARGIN * 2 })

    let headerBottom = PAGE_MARGIN + 8
    if (subtitle) {
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(120)
      doc.text(subtitle, PAGE_MARGIN, PAGE_MARGIN + 11, { maxWidth: pageWidth - PAGE_MARGIN * 2 })
      doc.setTextColor(0)
      headerBottom = PAGE_MARGIN + 14
    }

    const photo = photos[i]
    const availableWidth = pageWidth - PAGE_MARGIN * 2
    const availableHeight = pageHeight - headerBottom - PAGE_MARGIN
    const size = await loadImageSize(photo.photoUrl)
    if (size) {
      const ratio = Math.min(availableWidth / size.width, availableHeight / size.height)
      const drawWidth = size.width * ratio
      const drawHeight = size.height * ratio
      const offsetX = PAGE_MARGIN + (availableWidth - drawWidth) / 2
      const offsetY = headerBottom + (availableHeight - drawHeight) / 2
      doc.addImage(photo.photoUrl, detectImageFormat(photo.photoUrl), offsetX, offsetY, drawWidth, drawHeight)
    }

    if (photos.length > 1) {
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(150)
      doc.text(`${i + 1} / ${photos.length}`, pageWidth - PAGE_MARGIN, pageHeight - 6, { align: 'right' })
      doc.setTextColor(0)
    }
  }

  return doc
}

export function buildAnalysisPhotosPdfFileName(label, prefix = 'hata-analiz') {
  const safeName = slugifyForFileName(label || prefix)
  const date = new Date().toISOString().slice(0, 10)
  return `${prefix}-${safeName}-${date}.pdf`
}
