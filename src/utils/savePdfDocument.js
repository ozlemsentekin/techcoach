import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Web'de tarayıcı indirme (blob + <a download>) kullanılırken, native (iOS/Android) tarafta
 * doğrudan dosya indirme diye bir kavram yok — PDF önce Filesystem ile uygulama önbelleğine
 * yazılıp Share sheet'i (Kaydet/Paylaş) üzerinden kullanıcıya sunuluyor.
 */
export async function savePdfDocument(doc, fileName) {
  if (Capacitor.isNativePlatform()) {
    const base64 = doc.output('datauristring').split(',')[1]
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({ title: fileName, url: result.uri })
    return
  }

  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * "Yazdır" niyeti için: dosya indirmek yerine PDF'i yeni sekmede açar ve jsPDF'in autoPrint()'i
 * sayesinde tarayıcının yerleşik PDF görüntüleyicisi (Chrome/Edge) açılır açılmaz yazdırma
 * diyaloğunu kendiliğinden tetikler — savePdfDocument'ın indirme davranışından farklı olarak
 * kullanıcı hiçbir dosya indirmeden doğrudan yazıcı seçim ekranını görür. Native'de (iOS/Android)
 * tarayıcı PDF görüntüleyicisi/otomatik yazdırma yok, bu yüzden aynı Kaydet/Paylaş akışına
 * düşülür (paylaşım sayfasında genelde zaten bir yazdırma seçeneği vardır, ör. iOS AirPrint).
 *
 * `printWindow` — PDF üretimi (görsel yükleme vb.) birkaç await sürdüğünden, açılışı tıklama
 * anına (kullanıcı jesti) senkron olan bir `window.open('', '_blank')` çağrısı çağıran tarafta
 * ÖNCEDEN yapılıp buraya geçirilmeli; aksi halde tarayıcı popup engelleyicisi bu geç `window.open`
 * çağrısını engeller. Native'de kullanılmaz, boşsa kapatılır.
 */
export async function printPdfDocument(doc, fileName, printWindow) {
  if (Capacitor.isNativePlatform()) {
    printWindow?.close()
    await savePdfDocument(doc, fileName)
    return
  }

  doc.autoPrint()
  const blobUrl = doc.output('bloburl')
  let targetWindow
  if (printWindow && !printWindow.closed) {
    printWindow.location.href = blobUrl
    targetWindow = printWindow
  } else {
    targetWindow = window.open(blobUrl, '_blank')
  }

  // savePdfDocument'ın indirme linkindeki gibi hemen revoke edemeyiz — PDF görüntüleyici
  // bu URL'i sekme açıkken kullanmaya devam ediyor. Sekme kapanınca serbest bırakıyoruz;
  // hiç algılanamazsa (ör. popup engellendi, targetWindow null) belleği süresiz tutmamak
  // için üst sınır da var.
  if (!targetWindow) {
    URL.revokeObjectURL(blobUrl)
    return
  }
  const revoke = () => URL.revokeObjectURL(blobUrl)
  const pollId = setInterval(() => {
    if (targetWindow.closed) {
      clearInterval(pollId)
      revoke()
    }
  }, 2000)
  setTimeout(() => {
    clearInterval(pollId)
    revoke()
  }, 10 * 60 * 1000)
}
