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

// Uygulamadaki panel-blue/accent tonlarına yakın, PDF'te de okunaklı bir palet.
const COLORS = {
  accent: [204, 104, 42], // Button "primary" turuncusu
  accentSoft: [250, 235, 220],
  ink: [30, 30, 32],
  muted: [110, 110, 112],
  border: [214, 214, 216],
  cardBg: [247, 247, 249],
  correct: [16, 130, 90],
}

const PRIORITY = {
  yuksek: { bg: [211, 47, 47], tint: [252, 231, 231], label: 'YÜKSEK ÖNCELİK' },
  orta: { bg: [194, 115, 5], tint: [253, 240, 220], label: 'ORTA ÖNCELİK' },
  dusuk: { bg: [110, 120, 135], tint: [239, 241, 244], label: 'DÜŞÜK ÖNCELİK' },
}

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

// report.analyzedQuestions[i] hangi detail.wrongQuestions[idx] görseline ait? imageIndex alanı
// (Claude'a verdiğimiz "Soru N" etiketinin N'i) varsa onunla, yoksa (eski raporlar) sırayla eşler.
function buildImageAnalysisMap(report, totalImages) {
  const map = new Map()
  const analyzed = report?.analyzedQuestions || []
  const hasIndex = analyzed.length > 0 && analyzed.every((q) => Number.isInteger(q.imageIndex))
  analyzed.forEach((q, i) => {
    const idx = hasIndex ? q.imageIndex - 1 : i
    if (idx >= 0 && idx < totalImages && !map.has(idx)) map.set(idx, q)
  })
  return map
}

/**
 * AI analiz raporunu (görsel-metin bir arada, önceliklendirilmiş "bir bakışta" özetle) + analize
 * giren tüm hata görsellerini tek PDF'e alır.
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
  const fill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2])
  const ink = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2])
  const stroke = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  const wrap = (text, width, size, bold = false) => {
    doc.setFont('Roboto', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    return doc.splitTextToSize(String(text ?? ''), width)
  }

  const sectionHeading = (text) => {
    ensureSpace(14)
    cursorY += 3
    fill(COLORS.accent)
    doc.rect(PAGE_MARGIN, cursorY - 3.4, 2.6, 4.6, 'F')
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(11.5)
    ink(COLORS.ink)
    doc.text(text.toLocaleUpperCase('tr'), PAGE_MARGIN + 5, cursorY)
    cursorY += 2.6
    stroke(COLORS.border)
    doc.setLineWidth(0.3)
    doc.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY)
    cursorY += 6
    ink(COLORS.ink)
  }

  // Genel durum: sol renkli çubuklu, hafif dolgulu "callout" kutusu.
  const calloutBox = (text) => {
    const innerWidth = contentWidth - 11
    const lines = wrap(text, innerWidth, 10)
    const lineH = 4.6
    const boxHeight = lines.length * lineH + 7
    ensureSpace(boxHeight + 5)
    const top = cursorY
    fill(COLORS.accentSoft)
    doc.roundedRect(PAGE_MARGIN, top, contentWidth, boxHeight, 2, 2, 'F')
    fill(COLORS.accent)
    doc.rect(PAGE_MARGIN, top, 1.8, boxHeight, 'F')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(10)
    ink(COLORS.ink)
    let ly = top + 6
    lines.forEach((line) => {
      doc.text(line, PAGE_MARGIN + 8, ly)
      ly += lineH
    })
    cursorY = top + boxHeight + 6
  }

  // Eksik konu kartı: önceliğe göre renkli sol çubuk + dolgu + sağ üstte öncelik rozeti.
  const gapCard = (gap) => {
    const tone = PRIORITY[gap.priority] || PRIORITY.orta
    const barW = 2.2
    const padX = 4
    const padY = 3.2

    doc.setFont('Roboto', 'bold')
    doc.setFontSize(7.2)
    const badgeW = doc.getTextWidth(tone.label) + 5
    const badgeH = 5

    const innerWidth = contentWidth - barW - padX * 2
    const titleLines = wrap(gap.title, innerWidth - badgeW - 3, 10, true)
    const explLines = wrap(gap.explanation, innerWidth, 8.8)
    const titleLineH = 4.4
    const explLineH = 4
    const headH = Math.max(titleLines.length * titleLineH, badgeH + 1)
    const height = padY * 2 + headH + 2 + explLines.length * explLineH

    ensureSpace(height + 4)
    const top = cursorY

    fill(tone.tint)
    doc.roundedRect(PAGE_MARGIN, top, contentWidth, height, 1.6, 1.6, 'F')
    fill(tone.bg)
    doc.rect(PAGE_MARGIN, top, barW, height, 'F')

    // öncelik rozeti (sağ üst)
    doc.roundedRect(PAGE_MARGIN + contentWidth - badgeW - padX, top + padY - 0.6, badgeW, badgeH, badgeH / 2, badgeH / 2, 'F')
    ink([255, 255, 255])
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(7.2)
    doc.text(tone.label, PAGE_MARGIN + contentWidth - badgeW - padX + 2.5, top + padY - 0.6 + badgeH / 2 + 1.3)

    // başlık
    ink(COLORS.ink)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(10)
    let ty = top + padY + 3.2
    titleLines.forEach((line) => {
      doc.text(line, PAGE_MARGIN + barW + padX, ty, { maxWidth: innerWidth - badgeW - 3 })
      ty += titleLineH
    })

    // açıklama
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.8)
    ink(COLORS.muted)
    let ey = top + padY + headH + 2 + 3.2
    explLines.forEach((line) => {
      doc.text(line, PAGE_MARGIN + barW + padX, ey)
      ey += explLineH
    })

    ink(COLORS.ink)
    cursorY = top + height + 4
  }

  const numberedList = (items) => {
    items.forEach((text, index) => {
      const circleD = 5.6
      const innerWidth = contentWidth - circleD - 5
      const lines = wrap(text, innerWidth, 9.5)
      const lineH = 4.3
      const height = Math.max(lines.length * lineH, circleD)
      ensureSpace(height + 3)
      const top = cursorY

      fill(COLORS.accent)
      doc.circle(PAGE_MARGIN + circleD / 2, top + circleD / 2, circleD / 2, 'F')
      ink([255, 255, 255])
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(8)
      doc.text(String(index + 1), PAGE_MARGIN + circleD / 2, top + circleD / 2 + 1.3, { align: 'center' })

      ink(COLORS.ink)
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(9.5)
      let ly = top + 3.7
      lines.forEach((line) => {
        doc.text(line, PAGE_MARGIN + circleD + 5, ly)
        ly += lineH
      })
      cursorY = top + height + 3
    })
  }

  const chipsRow = (items) => {
    const rowH = 6.4
    let cx = PAGE_MARGIN
    ensureSpace(rowH)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.5)
    items.forEach((text) => {
      const w = doc.getTextWidth(text) + 5.5
      if (cx + w > PAGE_MARGIN + contentWidth) {
        cx = PAGE_MARGIN
        cursorY += rowH + 1.8
        ensureSpace(rowH)
      }
      fill(COLORS.cardBg)
      doc.roundedRect(cx, cursorY, w, rowH, rowH / 2, rowH / 2, 'F')
      ink(COLORS.muted)
      doc.text(text, cx + 2.7, cursorY + rowH / 2 + 1.3)
      cx += w + 2.6
    })
    cursorY += rowH + 6
    ink(COLORS.ink)
  }

  // --- Başlık ------------------------------------------------------------
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(18)
  ink(COLORS.accent)
  doc.text('AI Analiz Raporu', PAGE_MARGIN, cursorY + 6)
  cursorY += 11
  ink(COLORS.muted)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9.5)
  const createdAt = detail.createdAt ? new Date(detail.createdAt) : null
  const metaLine = [
    detail.subject,
    createdAt ? createdAt.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : null,
    `${detail.questionCount || detail.wrongQuestions?.length || 0} soru`,
  ].filter(Boolean).join('  ·  ')
  doc.text(metaLine, PAGE_MARGIN, cursorY)
  cursorY += 5
  if (detail.topicNames?.length) {
    wrap(`İçerikler: ${detail.topicNames.join(', ')}`, contentWidth, 9).forEach((line) => {
      doc.text(line, PAGE_MARGIN, cursorY)
      cursorY += 4.6
    })
  }
  ink(COLORS.ink)
  cursorY += 4

  const report = detail.report || {}

  if (report.overview) {
    sectionHeading('Genel durum')
    calloutBox(report.overview)
  }

  if (report.gaps?.length) {
    sectionHeading(`Eksikler — bir bakışta (${report.gaps.length})`)
    report.gaps.forEach(gapCard)
  }

  if (report.studyRecommendations?.length) {
    sectionHeading('Çalışma önerileri')
    numberedList(report.studyRecommendations)
  }

  if (report.reinforcementTopics?.length) {
    sectionHeading('Tekrar edilecek kazanımlar')
    chipsRow(report.reinforcementTopics)
  }

  // --- Soru soru analiz (görsel + analiz birlikte) ------------------------
  const items = detail.wrongQuestions || []
  if (items.length) {
    doc.addPage()
    cursorY = PAGE_MARGIN
    sectionHeading(`Soru soru analiz (${items.length})`)

    const analysisByIndex = buildImageAnalysisMap(report, items.length)

    for (let index = 0; index < items.length; index += 1) {
      const wq = items[index]
      const analysis = analysisByIndex.get(index)
      const caption = [wq.publisherName, wq.bookName, analysis?.testName || wq.testName].filter(Boolean).join(' · ')
      const correctAnswer = analysis?.correctAnswer || wq.correctAnswer || '-'

      ensureSpace(11)
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(7.4)
      const answerLabel = `DOĞRU: ${correctAnswer}`
      const badgeW = doc.getTextWidth(answerLabel) + 5
      fill(COLORS.correct)
      doc.roundedRect(PAGE_MARGIN + contentWidth - badgeW, cursorY - 3.8, badgeW, 5, 2.5, 2.5, 'F')
      ink([255, 255, 255])
      doc.text(answerLabel, PAGE_MARGIN + contentWidth - badgeW + 2.5, cursorY - 0.3)

      ink(COLORS.ink)
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(10.5)
      doc.text(`${index + 1}. ${caption || 'Kaynak belirtilmemiş'}`, PAGE_MARGIN, cursorY, {
        maxWidth: contentWidth - badgeW - 4,
      })
      cursorY += 5

      const subtitle = [wq.topic || analysis?.topic, `Soru ${wq.questionNumber ?? analysis?.questionNumber ?? '-'}`]
        .filter(Boolean).join(' · ')
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(8.6)
      ink(COLORS.muted)
      doc.text(subtitle, PAGE_MARGIN, cursorY)
      ink(COLORS.ink)
      cursorY += 5.5

      let photoUrl = null
      try {
        photoUrl = await fetchPhoto(wq.id)
      } catch {
        photoUrl = null
      }

      const maxImgHeight = 82
      let imgSize = null
      if (photoUrl) imgSize = await loadImageSize(photoUrl)

      if (photoUrl && imgSize) {
        const ratio = Math.min(contentWidth / imgSize.width, maxImgHeight / imgSize.height)
        const drawWidth = imgSize.width * ratio
        const drawHeight = imgSize.height * ratio
        ensureSpace(drawHeight + 4)
        stroke(COLORS.border)
        doc.setLineWidth(0.3)
        doc.rect(PAGE_MARGIN, cursorY, drawWidth, drawHeight)
        doc.addImage(photoUrl, detectImageFormat(photoUrl), PAGE_MARGIN, cursorY, drawWidth, drawHeight)
        cursorY += drawHeight + 4
      } else {
        ensureSpace(28)
        fill(COLORS.cardBg)
        doc.rect(PAGE_MARGIN, cursorY, contentWidth, 24, 'F')
        doc.setFontSize(8.5)
        ink(COLORS.muted)
        doc.text('Fotoğraf yüklenemedi', PAGE_MARGIN + contentWidth / 2, cursorY + 13, { align: 'center' })
        ink(COLORS.ink)
        cursorY += 28
      }

      // Analiz metni görselin altında, hafif dolgulu kutuda — "olası hata" öne çıkarılır.
      if (analysis) {
        const boxPadX = 5
        const boxPadY = 3
        const innerWidth = contentWidth - boxPadX * 2
        const askedLines = wrap(`Ne soruyor: ${analysis.whatItAsked}`, innerWidth, 8.8)
        const mistakeLines = wrap(`Olası hata: ${analysis.likelyMistake}`, innerWidth, 8.8, true)
        const lineH = 4
        const gapBetween = 1.4
        const boxHeight = boxPadY * 2 + askedLines.length * lineH + gapBetween + mistakeLines.length * lineH
        ensureSpace(boxHeight + 4)
        const top = cursorY
        fill(COLORS.cardBg)
        doc.roundedRect(PAGE_MARGIN, top, contentWidth, boxHeight, 1.6, 1.6, 'F')
        fill(PRIORITY.orta.bg)
        doc.rect(PAGE_MARGIN, top, 1.6, boxHeight, 'F')

        doc.setFont('Roboto', 'normal')
        doc.setFontSize(8.8)
        ink(COLORS.ink)
        let ty = top + boxPadY + 3
        askedLines.forEach((line) => {
          doc.text(line, PAGE_MARGIN + boxPadX, ty)
          ty += lineH
        })
        ty += gapBetween
        doc.setFont('Roboto', 'bold')
        ink(PRIORITY.orta.bg)
        mistakeLines.forEach((line) => {
          doc.text(line, PAGE_MARGIN + boxPadX, ty)
          ty += lineH
        })
        ink(COLORS.ink)
        cursorY = top + boxHeight + 7
      } else {
        cursorY += 4
      }

      ensureSpace(4)
      stroke(COLORS.border)
      doc.setLineWidth(0.2)
      doc.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY)
      cursorY += 6

      onProgress?.(index + 1, items.length)
    }
  }

  return doc
}
