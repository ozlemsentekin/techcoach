import { useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { saveSimpleTaskResult } from '../../../services/taskService'
import MistakePhotoCaptureModal from './MistakePhotoCaptureModal'

// "Basit kitap" (içerik/cevap anahtarı hiç girilmemiş) görevleri için sonuç girişi: kitapta test
// yoksa soru-soru optik yapılamaz, öğrenci sadece toplam doğru/yanlış/boş sayısını girer ve
// isteğe bağlı olarak yanlış sayısı kadar hata fotoğrafı ekleyebilir. Aynı "Tamamla" giriş
// noktasından (TaskListSection/TaskCompletionFlow) TaskAnswerSheetModal/QuestionCountModal'ın
// yerine açılır — bkz. taskCompletion.js resolveCompletionFlow 'simple_result' dalı.
export default function TaskSimpleResultModal({ task, studentId, onClose, onSaved }) {
  const [correctCount, setCorrectCount] = useState('')
  const [wrongCount, setWrongCount] = useState('')
  const [blankCount, setBlankCount] = useState('')
  const [photos, setPhotos] = useState([])
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const wrongCountNumber = Number(wrongCount) || 0
  const canAddMorePhotos = wrongCountNumber > 0 && photos.length < wrongCountNumber

  const handleRemovePhoto = (index) => {
    setPhotos((current) => current.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (correctCount === '' || wrongCount === '' || blankCount === '') {
      setError('Doğru, yanlış ve boş sayılarının hepsini girin.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updatedTask = await saveSimpleTaskResult(
        task.id,
        {
          correctCount: Number(correctCount),
          wrongCount: Number(wrongCount),
          blankCount: Number(blankCount),
          photos,
        },
        studentId,
      )
      onSaved?.(updatedTask)
    } catch (err) {
      setError(err.message || 'Sonuç kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Sonucu Gir</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-panel-text-muted">
          Bu kitapta cevap anahtarı yok, bu yüzden soru soru işaretleme yapılmıyor. Sadece toplam
          sonucunu gir.
        </p>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Doğru</span>
              <input
                type="number"
                min="0"
                value={correctCount}
                onChange={(event) => setCorrectCount(event.target.value)}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Yanlış</span>
              <input
                type="number"
                min="0"
                value={wrongCount}
                onChange={(event) => {
                  const next = event.target.value
                  setWrongCount(next)
                  const nextNumber = Number(next) || 0
                  if (photos.length > nextNumber) setPhotos((current) => current.slice(0, nextNumber))
                }}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Boş</span>
              <input
                type="number"
                min="0"
                value={blankCount}
                onChange={(event) => setBlankCount(event.target.value)}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>
          </div>

          {wrongCountNumber > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-panel-text-muted">
                Yanlış yaptığın sorulardan istersen fotoğraf ekle (en fazla {wrongCountNumber} adet, isteğe bağlı)
              </span>
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative overflow-hidden rounded-xl border border-panel-border">
                      <img src={photo} alt={`Yanlış soru fotoğrafı ${index + 1}`} className="h-20 w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Fotoğrafı kaldır"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {canAddMorePhotos ? (
                <button
                  type="button"
                  onClick={() => setShowPhotoCapture(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-panel-border px-4 py-2.5 text-sm font-semibold text-panel-text hover:bg-panel-surface-soft"
                >
                  <Camera size={16} aria-hidden="true" />
                  Fotoğraf Ekle
                </button>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-panel-warm">{error}</p> : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-student-theme-primary px-4 py-3 text-base font-semibold text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor...' : 'Tamamla'}
          </button>
        </div>
      </div>

      {showPhotoCapture ? (
        <MistakePhotoCaptureModal
          onClose={() => setShowPhotoCapture(false)}
          onSave={async (dataUrl) => {
            setPhotos((current) => [...current, dataUrl])
          }}
        />
      ) : null}
    </div>
  )
}
