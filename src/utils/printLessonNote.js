// Open synchronously from the click so browsers can allow the print window.
// Build the document with DOM APIs: note titles are untrusted text.
export async function printLessonNote(note) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Yazdırmak için bu siteye açılır pencere izni verin.')
  printWindow.opener = null
  const doc = printWindow.document
  doc.title = note.title
  doc.documentElement.lang = 'tr'
  const style = doc.createElement('style')
  style.textContent = `
    @page { size: A4 portrait; margin: 8mm; }
    body { margin: 0; background: #eef0f5; font-family: sans-serif; }
    header { padding: 16px; text-align: center; }
    button { padding: 10px 20px; cursor: pointer; }
    figure { margin: 12px auto; width: 194mm; max-width: 100%; background: white; }
    img { display: block; width: 100%; height: auto; }
    @media print {
      html, body { margin: 0; padding: 0; background: white; }
      header { display: none; }
      figure { margin: 0; width: 194mm; height: 280mm; break-inside: avoid; break-after: page; }
      figure:last-child { break-after: auto; }
      img { width: 100%; height: 100%; object-fit: contain; }
    }
  `
  doc.head.append(style)
  const header = doc.createElement('header')
  const title = doc.createElement('h1')
  title.textContent = note.title
  const status = doc.createElement('p')
  status.textContent = 'Görseller yazdırmaya hazırlanıyor…'
  const button = doc.createElement('button')
  button.textContent = 'Yazdır / PDF olarak kaydet'
  button.disabled = true
  button.onclick = () => printWindow.print()
  header.append(title, status, button)
  doc.body.append(header)
  try {
    await Promise.all(note.images.map((source, index) => new Promise((resolve, reject) => {
      const figure = doc.createElement('figure')
      const img = doc.createElement('img')
      img.alt = `${note.title} — sayfa ${index + 1}`
      img.onload = resolve
      img.onerror = () => reject(new Error('Bir görsel yüklenemedi. Notu yeniden açıp tekrar deneyin.'))
      img.src = source
      figure.append(img)
      doc.body.append(figure)
    })))
    if (printWindow.closed) return
    status.textContent = `${note.images.length} sayfa hazır. Her görsel ayrı A4 sayfasına sığdırılır.`
    button.disabled = false
    printWindow.focus()
    printWindow.print()
  } catch (error) {
    if (!printWindow.closed) status.textContent = error.message
    throw error
  }
}
