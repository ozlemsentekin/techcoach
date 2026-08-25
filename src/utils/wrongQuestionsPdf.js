import jsPDF from 'jspdf'
import { ROBOTO_REGULAR_TTF_BASE64, ROBOTO_BOLD_TTF_BASE64 } from './fonts/robotoTurkish'

const PAGE_MARGIN = 12
const BOX_GAP = 6
const ROW_GAP = 8
const CAPTION_HEIGHT = 11
const BOX_HEIGHT = 66
const TOPIC_HEADER_GAP = 9

// jsPDF'in yerleşik (Helvetica vb.) fontları WinAnsi encoding kullanıyor ve Türkçe'ye özgü
// ı/İ/ş/ğ karakterlerini içermiyor (ör. "İfadeler" "0fadeler" olarak basılıyordu). Bunu çözmek
// için Latin + Türkçe karakter setine subsetlenmiş bir Roboto TTF'i (bkz. fonts/robotoTurkish.js,
// yaklaşık 20KB/ağırlık) gömüp varsayılan font yerine kullanıyoruz.
function registerTurkishFont(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_TTF_BASE64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_TTF_BASE64)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
}

function detectImageFormat(dataUrl) {
  const match = /^data:image\/(\w+);base64,/i.exec(dataUrl || '')
  const type = (match?.[1] || 'jpeg').toLowerCase()
  return type === 'png' ? 'PNG' : 'JPEG'
}

function formatPageLabel(item) {
  const { pageStart, pageEnd } = item
  if (pageStart == null && pageEnd == null) return null
  if (pageStart != null && pageEnd != null && pageStart !== pageEnd) return `Sayfa ${pageStart}-${pageEnd}`
  return `Sayfa ${pageStart ?? pageEnd}`
}

function loadImageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 })
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

// Fotoğrafın üzerine gelen konu/kaynak kartı; sağına aynı boyutta boş bir "Yeniden Çöz" kutusu
// ekliyoruz ki PDF yazdırıldığında öğrenci soruyu tekrar çözebilsin. Kutu bilinçli olarak çizgisiz
// bırakılıyor — matematik çözümleri çizgiye sığmayabiliyor, serbest alan bırakmak daha kullanışlı.
function drawReworkBox(doc, x, y, width, height) {
  doc.setDrawColor(205)
  doc.setLineWidth(0.3)
  doc.rect(x, y, width, height)

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text('Yeniden Çöz', x + 3, y + 6)
  doc.setTextColor(0)
}

async function drawQuestionRow(doc, { x0, contentWidth, cursorY, item, fetchPhoto }) {
  const boxWidth = (contentWidth - BOX_GAP) / 2
  const photoX = x0
  const reworkX = x0 + boxWidth + BOX_GAP
  const boxTop = cursorY + CAPTION_HEIGHT

  const pageLabel = formatPageLabel(item)
  const secondLine = [pageLabel, `Soru ${item.questionNumber ?? '-'}`].filter(Boolean).join(' · ')

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(9.5)
  doc.text(`${item.topicName || item.topic || 'Genel'} · ${item.testName || 'Test'}`, x0, cursorY + 4, { maxWidth: contentWidth })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(secondLine, x0, cursorY + 8.5, { maxWidth: contentWidth })
  doc.setTextColor(0)

  let photoUrl = null
  try {
    photoUrl = await fetchPhoto(item.id)
  } catch {
    photoUrl = null
  }

  doc.setDrawColor(205)
  doc.setLineWidth(0.3)
  doc.rect(photoX, boxTop, boxWidth, BOX_HEIGHT)

  if (photoUrl) {
    const size = await loadImageSize(photoUrl)
    if (size) {
      const padding = 2
      const availableWidth = boxWidth - padding * 2
      const availableHeight = BOX_HEIGHT - padding * 2
      const ratio = Math.min(availableWidth / size.width, availableHeight / size.height)
      const drawWidth = size.width * ratio
      const drawHeight = size.height * ratio
      const offsetX = photoX + (boxWidth - drawWidth) / 2
      const offsetY = boxTop + (BOX_HEIGHT - drawHeight) / 2
      doc.addImage(photoUrl, detectImageFormat(photoUrl), offsetX, offsetY, drawWidth, drawHeight)
    }
  } else {
    doc.setFontSize(8.5)
    doc.text('Fotoğraf yüklenemedi', photoX + boxWidth / 2, boxTop + BOX_HEIGHT / 2, { align: 'center' })
  }

  drawReworkBox(doc, reworkX, boxTop, boxWidth, BOX_HEIGHT)

  return boxTop + BOX_HEIGHT + ROW_GAP
}

export async function buildWrongQuestionsPdf({ subject, source, fetchPhoto, onProgress }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerTurkishFont(doc)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PAGE_MARGIN * 2

  let cursorY = PAGE_MARGIN

  const ensureSpace = (height) => {
    if (cursorY + height > pageHeight - PAGE_MARGIN) {
      doc.addPage()
      cursorY = PAGE_MARGIN
    }
  }

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(14)
  doc.text(source.bookName || 'Kaynak belirtilmemiş', PAGE_MARGIN, cursorY + 6)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)
  doc.text([subject, source.publisherName].filter(Boolean).join(' · ') || ' ', PAGE_MARGIN, cursorY + 12)
  cursorY += 20

  const total = source.topics.reduce((sum, topicGroup) => sum + topicGroup.items.length, 0)
  let done = 0
  const rowHeight = CAPTION_HEIGHT + BOX_HEIGHT + ROW_GAP

  for (const topicGroup of source.topics) {
    ensureSpace(TOPIC_HEADER_GAP + rowHeight)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(11)
    doc.text(`${topicGroup.topic || 'Genel'} (${topicGroup.items.length} yanlış)`, PAGE_MARGIN, cursorY + 4)
    cursorY += TOPIC_HEADER_GAP

    for (const item of topicGroup.items) {
      ensureSpace(rowHeight)
      cursorY = await drawQuestionRow(doc, { x0: PAGE_MARGIN, contentWidth, cursorY, item, fetchPhoto })
      done += 1
      onProgress?.(done, total)
    }

    cursorY += 4
  }

  return doc
}

export function buildWrongQuestionsPdfFileName(bookName) {
  const safeName = (bookName || 'kaynak')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const date = new Date().toISOString().slice(0, 10)
  return `hata-defteri-${safeName}-${date}.pdf`
}
