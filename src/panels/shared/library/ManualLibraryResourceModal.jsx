import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Button from '../../ui/Button'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { RESOURCE_SOURCE_LABELS } from './libraryConstants'

const RESOURCE_BOOK_TYPES = [
  { value: 'konu_anlatimi', label: 'Konu Anlatımı' },
  { value: 'soru_bankasi', label: 'Soru Bankası' },
  { value: 'okuma_kitabi', label: 'Okuma Kitabı' },
  { value: 'etkinlik', label: 'Etkinlik & Soru Bankası' },
]

// Yayınevi listesi ve oluşturma admin-only uçları kullanır (bu ekran zaten sadece admin'e gösteriliyor),
// bkz. api/src/catalog.js listPublishersHandler / createPublisherHandler.
export default function ManualLibraryResourceModal({ grade, subjectId, subjectName, onClose, onSubmitted }) {
  const [publishers, setPublishers] = useState(null)
  const [publisherId, setPublisherId] = useState('')
  const [useNewPublisher, setUseNewPublisher] = useState(false)
  const [newPublisherName, setNewPublisherName] = useState('')

  const [name, setName] = useState('')
  const [pageCount, setPageCount] = useState('')
  const [type, setType] = useState('')
  const [publishMonthYear, setPublishMonthYear] = useState('')
  const [barcode, setBarcode] = useState('')
  const [resourceSource, setResourceSource] = useState('okul')
  const [isActive, setIsActive] = useState(true)
  const [hasAnswerKey, setHasAnswerKey] = useState(true)
  const [imageUrl, setImageUrl] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel-admin/publishers', { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setPublishers(data.publishers)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (name.trim().length < 2) {
      setError('Kaynak kitap adı en az 2 karakter olmalı.')
      return
    }
    const pageCountNumber = Number(pageCount)
    if (!Number.isInteger(pageCountNumber) || pageCountNumber <= 0) {
      setError('Sayfa sayısı pozitif bir tam sayı olmalı.')
      return
    }
    if (!type) {
      setError('Kaynak tipi seçilmeli.')
      return
    }
    if (!useNewPublisher && !publisherId) {
      setError('Yayınevi seçilmeli.')
      return
    }
    if (useNewPublisher && newPublisherName.trim().length < 2) {
      setError('Yayınevi adı en az 2 karakter olmalı.')
      return
    }
    if (barcode.trim() && !/^\d{4,50}$/.test(barcode.trim())) {
      setError('Barkod kodu sadece rakamlardan oluşmalı ve 4-50 karakter olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      let finalPublisherId = publisherId
      if (useNewPublisher) {
        const publisherData = await authRequest('/api/panel-admin/publishers', {
          method: 'POST',
          body: JSON.stringify({ name: newPublisherName.trim() }),
        })
        finalPublisherId = publisherData.publisher.id
      }

      const data = await authRequest('/api/panel-admin/resource-books', {
        method: 'POST',
        body: JSON.stringify({
          publisherId: finalPublisherId,
          subjectId,
          name: name.trim(),
          pageCount: pageCountNumber,
          isActive,
          type,
          grade,
          publishMonthYear: publishMonthYear.trim() || null,
          hasAnswerKey: type === 'soru_bankasi' ? hasAnswerKey : true,
          imageUrl: imageUrl.trim() || null,
          barcode: barcode.trim() || null,
          resourceSource,
        }),
      })
      onSubmitted(data.resourceBook)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#12142a]">Kaynak Ekle</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              {grade}. Sınıf{subjectName ? ` · ${subjectName}` : ''} dersine kaynak ekle
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-panel-text-muted hover:bg-[#faf3ec] hover:text-[#b85f22]"
          >
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:gap-5">
          <div className="flex justify-center sm:justify-start">
            <ResourceImageField
              value={imageUrl}
              onChange={setImageUrl}
              compact
              size={200}
              showUrlToggle
              accent="#b85f22"
              accentSoft="#f8e3d0"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>

            {!useNewPublisher ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Yayınevi</span>
                <select
                  value={publisherId}
                  onChange={(event) => setPublisherId(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                >
                  <option value="" disabled>
                    {publishers === null ? 'Yükleniyor...' : 'Yayınevi seçin'}
                  </option>
                  {publishers?.map((publisher) => (
                    <option key={publisher.id} value={publisher.id}>
                      {publisher.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseNewPublisher(true)}
                  className="w-fit text-xs font-medium text-panel-blue hover:underline"
                >
                  Listede yok, yeni yayınevi ekle
                </button>
              </label>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Yeni Yayınevi Adı</span>
                <input
                  value={newPublisherName}
                  onChange={(event) => setNewPublisherName(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  placeholder="Yayınevi adı"
                />
                <button
                  type="button"
                  onClick={() => setUseNewPublisher(false)}
                  className="w-fit text-xs font-medium text-panel-blue hover:underline"
                >
                  Listeden seçmek istiyorum
                </button>
              </label>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Basım Ay/Yıl</span>
                <input
                  value={publishMonthYear}
                  onChange={(event) => setPublishMonthYear(event.target.value)}
                  placeholder="Örn. Eylül 2024"
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Sayfa Sayısı</span>
                <input
                  type="number"
                  min="1"
                  value={pageCount}
                  onChange={(event) => setPageCount(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kaynak Tipi</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                >
                  <option value="" disabled>
                    Tip seçin
                  </option>
                  {RESOURCE_BOOK_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kaynak Türü</span>
                <select
                  value={resourceSource}
                  onChange={(event) => setResourceSource(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                >
                  {Object.entries(RESOURCE_SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Barkod Kodu</span>
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Örn. 9789750000000"
                inputMode="numeric"
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>

            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4" />
              <span className="text-sm font-medium text-panel-text">Aktif</span>
            </label>

            {type === 'soru_bankasi' ? (
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={hasAnswerKey}
                  onChange={(event) => setHasAnswerKey(event.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-panel-text">Cevap Anahtarı Var</span>
              </label>
            ) : null}
          </div>
        </div>

        <Button type="submit" disabled={loading} size="md" className="mt-5 w-full">
          {loading ? 'Kaydediliyor...' : 'Kaynak Kitap Oluştur'}
        </Button>
      </form>
    </div>
  )
}
