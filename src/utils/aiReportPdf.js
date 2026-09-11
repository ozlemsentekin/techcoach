import jsPDF from 'jspdf'
import { ROBOTO_REGULAR_TTF_BASE64, ROBOTO_BOLD_TTF_BASE64 } from './fonts/robotoTurkish'

// jsPDF'in yerleşik fontları Türkçe ı/İ/ş/ğ karakterlerini içermiyor; subsetlenmiş Roboto gömülür
// (bkz. wrongQuestionsPdf.js'deki aynı gerekçe).
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

function loadImageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 })
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

const PAGE_MARGIN = 14
const PRIORITY_LABEL = { yuksek: 'YÜKSEK ÖNCELİK', orta: 'ORTA ÖNCELİK', dusuk: 'DÜŞÜK ÖNCELİK' }

const slug = (value) =>
  (value || 'rapor')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function buildAiReportPdfFileName(subject, createdAt) {
  const date = (createdAt ? new Date(createdAt) : new Date()).toISOString().slice(0, 10)
  return `ai-rapor-${slug(subject)}-${date}.pdf`
}

/**
 * AI analiz raporunu (metin) + analize giren tüm hata görsellerini tek PDF'e alır.
 * @param {object} detail getAiReport / fetchReportDetail çıktısı (report + wrongQuestions + meta)
 * @param {(wrongQuestionId:string)=>Promise<string>} fetchPhoto tembel görsel çekici
 * @param {(done:number,total:number)=>void} [onProgress]
 */
export async function buildAiReportPdf(detail, fetchPhoto, onProgress) {
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

  const writeParagraph = (text, { size = 10, bold = false, gap = 4, color = 0, indent = 0 } = {}) => {
    if (!text) return
    doc.setFont('Roboto', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(String(text), contentWidth - indent)
    const lineHeight = size * 0.42 + 1.2
    lines.forEach((line) => {
      ensureSpace(lineHeight)
      doc.text(line, PAGE_MARGIN + indent, cursorY)
      cursorY += lineHeight
    })
    cursorY += gap
    doc.setTextColor(0)
  }

  const sectionHeading = (text) => {
    ensureSpace(12)
    cursorY += 2
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30)
    doc.text(text, PAGE_MARGIN, cursorY)
    cursorY += 2
    doc.setDrawColor(210)
    doc.setLineWidth(0.4)
    doc.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY)
    cursorY += 5
    doc.setTextColor(0)
  }

  const report = detail.report || {}
  const createdAt = detail.createdAt ? new Date(detail.createdAt) : null

  // Başlık
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.text('AI Analiz Raporu', PAGE_MARGIN, cursorY + 4)
  cursorY += 10
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  const metaLine = [
    detail.subject,
    createdAt ? createdAt.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : null,
    `${detail.questionCount || detail.wrongQuestions?.length || 0} soru`,
  ].filter(Boolean).join('  ·  ')
  doc.text(metaLine, PAGE_MARGIN, cursorY)
  cursorY += 6
  if (detail.topicNames?.length) {
    doc.setTextColor(90)
    const topicLines = doc.splitTextToSize(`İçerikler: ${detail.topicNames.join(', ')}`, contentWidth)
    topicLines.forEach((line) => {
      ensureSpace(5)
      doc.text(line, PAGE_MARGIN, cursorY)
      cursorY += 5
    })
  }
  doc.setTextColor(0)
  cursorY += 3

  if (report.overview) {
    sectionHeading('Genel durum')
    writeParagraph(report.overview)
  }

  if (report.gaps?.length) {
    sectionHeading('Eksik konular')
    report.gaps.forEach((gap) => {
      writeParagraph(`• ${gap.title}  (${PRIORITY_LABEL[gap.priority] || 'ÖNCELİK'})`, { bold: true, gap: 1.5 })
      writeParagraph(gap.explanation, { size: 9.5, color: 90, indent: 4 })
    })
  }

  if (report.studyRecommendations?.length) {
    sectionHeading('Çalışma önerileri')
    report.studyRecommendations.forEach((item, index) => {
      writeParagraph(`${index + 1}. ${item}`, { size: 10, gap: 2.5, indent: 2 })
    })
  }

  if (report.reinforcementTopics?.length) {
    sectionHeading('Tekrar edilecek kazanımlar')
    writeParagraph(report.reinforcementTopics.map((t) => `• ${t}`).join('\n'), { size: 9.5, gap: 3 })
  }

  if (report.analyzedQuestions?.length) {
    sectionHeading('Analiz edilen sorular')
    report.analyzedQuestions.forEach((q) => {
      writeParagraph(`${q.testName} · Soru ${q.questionNumber}  —  Doğru cevap: ${q.correctAnswer || '-'}`, {
        bold: true, size: 9.5, gap: 1.2,
      })
      if (q.topic) writeParagraph(q.topic, { size: 8.5, color: 120, gap: 1, indent: 3 })
      writeParagraph(`Ne soruyor: ${q.whatItAsked}`, { size: 9, color: 60, gap: 1, indent: 3 })
      writeParagraph(`Olası hata: ${q.likelyMistake}`, { size: 9, color: 60, gap: 3, indent: 3 })
    })
  }

  // Hata görselleri
  const items = detail.wrongQuestions || []
  if (items.length) {
    doc.addPage()
    cursorY = PAGE_MARGIN
    sectionHeading(`Hata görselleri (${items.length})`)

    const imgMaxHeight = 150
    let done = 0
    for (const item of items) {
      const caption = [item.publisherName, item.bookName, item.testName].filter(Boolean).join(' · ')
      const captionLine2 = `${item.topic || 'Genel'} · Soru ${item.questionNumber ?? '-'} · Doğru cevap: ${item.correctAnswer || '-'}`

      let photoUrl = null
      try {
        photoUrl = await fetchPhoto(item.id)
      } catch {
        photoUrl = null
      }

      let drawHeight = 40
      let size = null
      if (photoUrl) {
        size = await loadImageSize(photoUrl)
        if (size) {
          const ratio = Math.min(contentWidth / size.width, imgMaxHeight / size.height)
          drawHeight = size.height * ratio
        }
      }

      ensureSpace(14 + drawHeight + 6)
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(0)
      doc.text(caption || 'Kaynak belirtilmemiş', PAGE_MARGIN, cursorY, { maxWidth: contentWidth })
      cursorY += 4.5
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(120)
      doc.text(captionLine2, PAGE_MARGIN, cursorY, { maxWidth: contentWidth })
      doc.setTextColor(0)
      cursorY += 4

      if (photoUrl && size) {
        const ratio = Math.min(contentWidth / size.width, imgMaxHeight / size.height)
        const drawWidth = size.width * ratio
        doc.addImage(photoUrl, detectImageFormat(photoUrl), PAGE_MARGIN, cursorY, drawWidth, size.height * ratio)
        cursorY += size.height * ratio + 8
      } else {
        doc.setDrawColor(205)
        doc.rect(PAGE_MARGIN, cursorY, contentWidth, 30)
        doc.setFontSize(8.5)
        doc.text('Fotoğraf yüklenemedi', PAGE_MARGIN + contentWidth / 2, cursorY + 16, { align: 'center' })
        cursorY += 38
      }

      done += 1
      onProgress?.(done, items.length)
    }
  }

  return doc
}
