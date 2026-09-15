import { useEffect, useState } from 'react'
import { Image as ImageIcon, Loader2, X } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'

function formatAddedAt(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

// "Hata Analizlerim" menüsü: veli tarafından eklenmiş Hata Analiz görsellerini YayınEvi/Kaynak/
// İçerik/Test/Soru No tablosunda listeler; "Analizi Göster" tembel çekip büyük görselde açar
// (WrongQuestionGalleryModal'daki aynı desen, bkz. o dosyadaki analysisPhotoOpen yorumu). Öğrenci
// ve veli panelinde tek öğrenci bağlamında, öğretmen panelinde kendi kapsamındaki tüm öğrenciler
// için (bu yüzden showStudentColumn) kullanılır.
export default function AnalysisPhotosPage({
  fetchItems,
  fetchPhoto,
  showStudentColumn = false,
  title = 'Hata Analizlerim',
  subtitle = 'Eklenen hata analiz görsellerine buradan ulaşabilirsin.',
  headerActions,
  backSlot = null,
}) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [openItem, setOpenItem] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [loadingPhoto, setLoadingPhoto] = useState(false)

  useEffect(() => {
    let ignore = false
    setItems(null)
    setError('')
    fetchItems()
      .then((data) => {
        if (!ignore) setItems(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [fetchItems])

  const handleShow = async (item) => {
    setOpenItem(item)
    setPhotoUrl('')
    setPhotoError('')
    setLoadingPhoto(true)
    try {
      const url = await fetchPhoto(item.id)
      setPhotoUrl(url)
    } catch (err) {
      setPhotoError(err.message || 'Hata analiz görseli yüklenemedi.')
    } finally {
      setLoadingPhoto(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {backSlot ? <div>{backSlot}</div> : null}
      <PageHeader title={title} subtitle={subtitle} actions={headerActions} />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : items === null ? (
        <LoadingState label="Hata analizleri yükleniyor..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Henüz hata analizi yok"
          description="Hata Defteri'nde bir soruya Hata Analiz görseli eklendiğinde burada listelenecek."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-panel-border bg-panel-surface">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border bg-panel-surface-soft text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">
                {showStudentColumn ? <th className="px-3 py-2.5">Öğrenci</th> : null}
                <th className="px-3 py-2.5">Ders</th>
                <th className="px-3 py-2.5">Yayın Evi</th>
                <th className="px-3 py-2.5">Kaynak</th>
                <th className="px-3 py-2.5">İçerik Adı</th>
                <th className="px-3 py-2.5">Test Adı</th>
                <th className="px-3 py-2.5">Soru No</th>
                <th className="px-3 py-2.5">Eklenme Tarihi</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-panel-border last:border-0 hover:bg-panel-surface-soft">
                  {showStudentColumn ? (
                    <td className="px-3 py-2.5 font-medium text-panel-text">{item.studentFullName || '—'}</td>
                  ) : null}
                  <td className="px-3 py-2.5 text-panel-text">{item.subject || '—'}</td>
                  <td className="px-3 py-2.5 text-panel-text-muted">{item.publisherName || '—'}</td>
                  <td className="px-3 py-2.5 text-panel-text-muted">{item.bookName || '—'}</td>
                  <td className="px-3 py-2.5 text-panel-text-muted">{item.topicName || item.topic || '—'}</td>
                  <td className="px-3 py-2.5 text-panel-text-muted">{item.testName || '—'}</td>
                  <td className="px-3 py-2.5 text-panel-text-muted">{item.questionNumber ?? '—'}</td>
                  <td className="px-3 py-2.5 text-panel-text-muted">{formatAddedAt(item.analysisPhotoAddedAt)}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleShow(item)}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-panel-blue px-3 py-1.5 text-xs font-bold text-panel-blue hover:bg-panel-blue-soft"
                    >
                      <ImageIcon size={14} aria-hidden="true" />
                      Analizi Göster
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openItem ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-panel-text/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Hata Analiz görseli"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-white/80">
            {openItem.testName || openItem.topic || 'Hata Analiz'}
            {openItem.questionNumber != null ? ` · Soru No: ${openItem.questionNumber}` : ''}
          </span>
          {photoUrl ? (
            <img loading="lazy" decoding="async"
              src={photoUrl}
              alt="Hata analiz görseli"
              className="max-h-[85vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
            />
          ) : photoError ? (
            <p className="max-w-xs text-center text-sm text-white/70">{photoError}</p>
          ) : loadingPhoto ? (
            <div className="flex flex-col items-center gap-2 text-white/70">
              <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              <span className="text-xs">Görsel yükleniyor...</span>
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setOpenItem(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
