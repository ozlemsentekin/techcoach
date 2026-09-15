import { useEffect, useState } from 'react'
import { FileText, Image as ImageIcon } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import AnalysisPhotoViewer from './AnalysisPhotoViewer'

function formatAddedAt(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

// "Hata Analizlerim" menüsü: veli tarafından eklenmiş Hata Analiz görsellerini YayınEvi/Kaynak/
// İçerik/Test/Soru No tablosunda listeler; "Analizi Göster" AnalysisPhotoViewer'ı açar (slayt gibi
// gezinme + yazdırma — bkz. o dosyadaki yorum). Ekleme/kaldırma burada değil, Hata Defteri'nden
// yapılır (bu sayfa salt-görüntüleme). Öğrenci ve veli panelinde tek öğrenci bağlamında, öğretmen
// panelinde kendi kapsamındaki tüm öğrenciler için (bu yüzden showStudentColumn) kullanılır.
export default function AnalysisPhotosPage({
  fetchItems,
  fetchPhotos,
  fetchQuestionPhoto,
  showStudentColumn = false,
  title = 'Hata Analizlerim',
  subtitle = 'Eklenen hata analiz görsellerine buradan ulaşabilirsin.',
  headerActions,
  backSlot = null,
}) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [openItem, setOpenItem] = useState(null)
  const [openQuestionItem, setOpenQuestionItem] = useState(null)

  // AnalysisPhotoViewer birden fazla görsel bekliyor (slayt gibi gezinme için); asıl soru
  // fotoğrafı tek görsel olduğundan tek elemanlı bir dizi olarak sarmalanır — aynı bileşen hem
  // "Analizi Göster" hem "Soruyu Göster" için (slayt/yazdırma dahil) yeniden kullanılır.
  const fetchQuestionPhotos = fetchQuestionPhoto
    ? async (id) => {
        const url = await fetchQuestionPhoto(id)
        return url ? [{ id, photoUrl: url }] : []
      }
    : undefined

  useEffect(() => {
    let ignore = false
    fetchItems()
      .then((data) => {
        if (ignore) return
        setError('')
        setItems(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [fetchItems])

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
                <th className="px-3 py-2.5">Son Ekleme</th>
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
                    <div className="flex flex-wrap items-center gap-2">
                      {fetchQuestionPhoto ? (
                        <button
                          type="button"
                          onClick={() => setOpenQuestionItem(item)}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-panel-border px-3 py-1.5 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft"
                        >
                          <FileText size={14} aria-hidden="true" />
                          Soruyu Göster
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOpenItem(item)}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-panel-blue px-3 py-1.5 text-xs font-bold text-panel-blue hover:bg-panel-blue-soft"
                      >
                        <ImageIcon size={14} aria-hidden="true" />
                        Analizi Göster{item.analysisPhotoCount > 1 ? ` (${item.analysisPhotoCount})` : ''}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openItem ? (
        <AnalysisPhotoViewer
          wrongQuestionId={openItem.id}
          fetchPhotos={fetchPhotos}
          contextLabel={[
            openItem.publisherName,
            openItem.testName || openItem.topic,
            openItem.questionNumber != null ? `Soru ${openItem.questionNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setOpenItem(null)}
        />
      ) : null}

      {openQuestionItem ? (
        <AnalysisPhotoViewer
          wrongQuestionId={openQuestionItem.id}
          fetchPhotos={fetchQuestionPhotos}
          title="Soru"
          pdfFileNamePrefix="hata-defteri-soru"
          contextLabel={[
            openQuestionItem.publisherName,
            openQuestionItem.testName || openQuestionItem.topic,
            openQuestionItem.questionNumber != null ? `Soru ${openQuestionItem.questionNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setOpenQuestionItem(null)}
        />
      ) : null}
    </div>
  )
}
