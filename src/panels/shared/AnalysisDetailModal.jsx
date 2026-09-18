import { Image as ImageIcon, X } from 'lucide-react'
import AnalysisCommentFeed from './AnalysisCommentFeed'

// "Analizi Gör" tıklandığında açılan tekil detay ekranı: bir sorunun üzerindeki TÜM analiz
// yorumlarını (öğrenci/veli/öğretmen, kronolojik — bkz. mistakeAnalysis.js) ve varsa veli
// tarafından eklenmiş Hata Analiz görselini tek yerde gösterir. Salt-okunur (ekleme/kaldırma Hata
// Defteri'nden yapılır); görsel bölümü sadece bir "Görseli Büyüt" tetikleyicisi taşır, asıl
// slayt/yazdırma AnalysisPhotoViewer (z-[70]) bu modalın (z-[60]) üzerine açılır.
export default function AnalysisDetailModal({ item, onClose, onShowPhotos }) {
  if (!item) return null

  const contextLabel = [item.publisherName, item.bookName].filter(Boolean).join(' · ')
  const testLabel = [item.testName, item.questionNumber != null ? `Soru ${item.questionNumber}` : null]
    .filter(Boolean)
    .join(' · ')
  const comments = item.analysisComments || []
  const hasAnything = comments.length > 0 || item.analysisPhotoCount > 0

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-panel-text/40 sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Analiz detayı"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-panel-surface shadow-panel-2 sm:max-w-lg sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-panel-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-panel-text">{item.topicName || item.topic || 'Hata Analizi'}</h2>
            <p className="truncate text-xs text-panel-text-muted">{[contextLabel, testLabel].filter(Boolean).join(' · ')}</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {comments.length > 0 ? (
            <section>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-panel-text-muted">
                Analiz Yorumları ({comments.length})
              </div>
              <AnalysisCommentFeed comments={comments} />
            </section>
          ) : null}

          {item.analysisPhotoCount > 0 ? (
            <section className="rounded-xl border border-panel-border p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-panel-lilac">
                <ImageIcon size={14} aria-hidden="true" />
                Hata Analiz Görseli{item.analysisPhotoCount > 1 ? ` (${item.analysisPhotoCount})` : ''}
              </div>
              <button
                type="button"
                onClick={onShowPhotos}
                className="flex items-center gap-1.5 rounded-full border-2 border-panel-lilac px-3 py-1.5 text-xs font-bold text-panel-lilac hover:bg-panel-lilac-soft"
              >
                <ImageIcon size={14} aria-hidden="true" />
                Görseli Büyüt
              </button>
            </section>
          ) : null}

          {!hasAnything ? <p className="text-sm text-panel-text-muted">Bu soru için henüz bir analiz bulunmuyor.</p> : null}
        </div>
      </div>
    </div>
  )
}
