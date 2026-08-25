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
