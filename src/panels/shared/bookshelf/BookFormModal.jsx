import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Check, ClipboardList, Info, Plus, ScanLine, X } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { authRequest } from '../../../services/authClient'
import {
  createBookshelfBook,
  createBookshelfPublisher,
  getBookshelfStudents,
  updateBookshelfBook,
} from '../../../services/bookshelfService'
import { BOOKSHELF_GRADE_OPTIONS, BOOKSHELF_RESOURCE_TYPES } from './bookshelfConstants'
import StudentPicker from './StudentPicker'

// Kitaplık "Yeni Kitap Ekle" / "Kitabı Düzenle" formu. Kütüphanedeki ResourceBookModal ile
// aynı alanlar (yayın evi, ad, ders, sınıf, tip, görsel, cevap anahtarı) + oluştururken hangi
// çocuk/öğrencilere atanacağı adımı. Kaydedince oluşan/güncellenen kaynağı döndürür.
export default function BookFormModal({ book, onSaved, onClose }) {
  const isEdit = Boolean(book)
  const [subjects, setSubjects] = useState(null)
  const [publishers, setPublishers] = useState(null)
  const [students, setStudents] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [name, setName] = useState(book?.name || '')
  const [subjectId, setSubjectId] = useState(book?.subjectId || '')
  const [grade, setGrade] = useState(book?.grade || '')
  const [type, setType] = useState(book?.type || '')
  const [publisherId, setPublisherId] = useState(book?.publisherId || '')
  const [newPublisherName, setNewPublisherName] = useState('')
  const [addingPublisher, setAddingPublisher] = useState(false)
  const [hasAnswerKey, setHasAnswerKey] = useState(book ? book.hasAnswerKey : true)
  const [imageUrl, setImageUrl] = useState(book?.imageUrl || '')
  const [contentMode, setContentMode] = useState(book?.contentMode || 'structured')
  const isSimpleContentMode = contentMode === 'simple'

  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set())

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    Promise.all([
      authRequest('/api/panel/subjects', { method: 'GET' }),
      authRequest('/api/panel/publishers', { method: 'GET' }),
      getBookshelfStudents(),
    ])
      .then(([subjectsData, publishersData, studentList]) => {
        if (ignore) return
        setSubjects(subjectsData.subjects)
        setPublishers(publishersData.publishers)
        setStudents(studentList)
        // Tek çocuk/öğrenci varsa (ör. tek çocuklu veli, öğrenci hesabı) otomatik seç.
        if (!isEdit && studentList.length === 1) {
          setSelectedStudentIds(new Set([String(studentList[0].id)]))
        }
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [isEdit])

  const sortedPublishers = useMemo(
    () =>
      [...(publishers || [])].sort((a, b) =>
        a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }),
      ),
    [publishers],
  )

  const toggleStudent = (id) => {
    setSelectedStudentIds((current) => {
      const next = new Set(current)
      const key = String(id)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleAddPublisher = async () => {
    const trimmed = newPublisherName.trim()
    if (trimmed.length < 2) {
      setError('Yayın evi adı en az 2 karakter olmalı.')
      return
    }
    setAddingPublisher(true)
    setError('')
    try {
      const publisher = await createBookshelfPublisher(trimmed)
      setPublishers((current) => {
        const exists = (current || []).some((item) => item.id === publisher.id)
        return exists ? current : [...(current || []), publisher]
      })
      setPublisherId(publisher.id)
      setNewPublisherName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingPublisher(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (name.trim().length < 2) return setError('Kaynak adı en az 2 karakter olmalı.')
    if (!subjectId) return setError('Ders seçilmeli.')
    if (!grade) return setError('Sınıf seçilmeli.')
    if (!isSimpleContentMode && !type) return setError('Kaynak tipi seçilmeli.')
    if (!publisherId && newPublisherName.trim().length < 2) return setError('Yayın evi seçilmeli.')
    if (!isEdit && selectedStudentIds.size === 0) {
      return setError('En az bir çocuk/öğrenci seçilmeli.')
    }

    setError('')
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        subjectId,
        grade,
        type: isSimpleContentMode ? 'soru_bankasi' : type,
        hasAnswerKey: isSimpleContentMode ? false : type === 'soru_bankasi' ? hasAnswerKey : true,
        contentMode,
        imageUrl: imageUrl.trim() || null,
        ...(publisherId ? { publisherId } : { newPublisherName: newPublisherName.trim() }),
      }
      const saved = isEdit
        ? await updateBookshelfBook(book.id, payload)
        : await createBookshelfBook({ ...payload, studentIds: [...selectedStudentIds] })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-form-title"
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl sm:p-7"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="book-form-title" className="text-2xl font-bold text-panel-text">{isEdit ? 'Kitabı Düzenle' : 'Yeni Kitap Ekle'}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-panel-text-muted">
              Bu kaynak yalnızca seçtiğiniz çocuk/öğrencilerin kitaplığında görünür; sistem kütüphanesine eklenmez.
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="rounded-full p-2 text-panel-text-muted transition hover:bg-panel-accent-soft hover:text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-panel-accent">
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
        ) : null}
        {loadError ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{loadError}</div>
        ) : null}

        {subjects === null || publishers === null || students === null ? (
          <LoadingState label="Form yükleniyor..." />
        ) : (
          <div className="space-y-6">
            <fieldset>
              <legend className="text-base font-semibold text-panel-text">Kitabı nasıl kullanacaksınız?</legend>
              <p className="mt-1 text-sm text-panel-text-muted">İçerik ve cevap anahtarı eklemek, sonuçları nasıl takip edeceğinizi belirler.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { value: 'structured', icon: <ScanLine size={22} aria-hidden="true" />, title: 'İçerik ve cevap anahtarıyla', subtitle: 'Konu ve test bazında takip', features: ['Konu ve testleri siz eklersiniz', 'Cevap anahtarıyla optik okuma yapılır', 'Sonuçlar cevap anahtarıyla değerlendirilir'] },
                  { value: 'simple', icon: <ClipboardList size={22} aria-hidden="true" />, title: 'İçerik ve cevap anahtarı olmadan', subtitle: 'Görev ve sonuç takibi', features: ['Konu, test ve cevap anahtarı girmezsiniz', 'Kitap üzerinden görev verebilirsiniz', 'Sonuçları elle girersiniz'] },
                ].map(({ value, icon, title, subtitle, features }) => {
                  const selected = contentMode === value
                  return (
                    <label key={value} className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-panel-accent focus-within:ring-offset-2 ${selected ? 'border-panel-accent bg-panel-accent-soft' : 'border-panel-border bg-panel-surface hover:border-panel-accent/50'}`}>
                      <input type="radio" name="book-content-mode" value={value} checked={selected} onChange={() => setContentMode(value)} className="sr-only" />
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`rounded-xl p-2 ${selected ? 'bg-panel-accent text-white' : 'bg-panel-border/30 text-panel-text'}`}>{icon}</span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? 'border-panel-accent bg-panel-accent text-white' : 'border-panel-text-muted'}`}>{selected && <Check size={16} aria-hidden="true" />}</span>
                      </div>
                      <span className="text-base font-bold leading-snug text-panel-text">{title}</span>
                      <span className="mt-1 text-sm text-panel-text-muted">{subtitle}</span>
                      <ul className="mt-4 space-y-2 border-t border-panel-text/10 pt-3">
                        {features.map((feature) => <li key={feature} className="flex gap-2 text-sm leading-relaxed text-panel-text"><Check size={16} className="mt-0.5 shrink-0 text-panel-warm" aria-hidden="true" />{feature}</li>)}
                      </ul>
                    </label>
                  )
                })}
              </div>
              <div aria-live="polite" className="mt-3 flex items-start gap-2 rounded-xl bg-panel-border/20 px-4 py-3 text-sm leading-relaxed text-panel-text">
                <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p><span className="font-semibold">Ekledikten sonra: </span>{isSimpleContentMode ? 'Kitaba görev verebilir, çalışma sonuçlarını elle kaydedebilirsiniz. İçerik veya cevap anahtarı hazırlamanız gerekmez.' : 'Kitabın detayından konu, test ve cevap anahtarlarını ekleyebilirsiniz. Optik okuma için cevap anahtarlarını tamamlamanız gerekir.'}</p>
              </div>
            </fieldset>

            <div className="border-t border-panel-border pt-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-panel-text"><BookOpen size={18} aria-hidden="true" />Kitap bilgileri</h3>
              <div className="grid gap-5 sm:grid-cols-[144px_1fr]">
                <div className="flex flex-col items-center gap-2 sm:items-start">
                  <ResourceImageField value={imageUrl} onChange={setImageUrl} compact size={144} showUrlToggle fit="contain" />
                  <span className="text-sm font-medium text-panel-text">Kitap kapağı</span>
                  <span className="text-xs text-panel-text-muted">İsteğe bağlı</span>
                </div>
            <div className="flex flex-col gap-3">
              {!isEdit && students.length > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Kime eklensin?</span>
                  <StudentPicker
                    students={students}
                    selectedIds={selectedStudentIds}
                    onToggle={toggleStudent}
                  />
                </div>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
                <input
                  placeholder="Örn. 8. Sınıf Matematik Soru Bankası"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-2.5 text-base text-panel-text outline-none focus:border-panel-accent focus:ring-2 focus:ring-panel-accent/20"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Yayın Evi</span>
                <select
                  aria-label="Yayın evi"
                  value={publisherId}
                  onChange={(event) => setPublisherId(event.target.value)}
                  className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-2.5 text-base text-panel-text outline-none focus:border-panel-accent focus:ring-2 focus:ring-panel-accent/20"
                >
                  <option value="">Yayın evi seçin</option>
                  {sortedPublishers.map((publisher) => (
                    <option key={publisher.id} value={publisher.id}>
                      {publisher.name}
                    </option>
                  ))}
                </select>
                {!publisherId ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={newPublisherName}
                      onChange={(event) => setNewPublisherName(event.target.value)}
                      placeholder="veya yeni yayın evi adı yazın"
                      aria-label="Yeni yayın evi adı"
                      className="min-w-0 flex-1 rounded-xl border border-panel-border p-2 text-sm text-panel-text"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={addingPublisher || newPublisherName.trim().length < 2}
                      onClick={handleAddPublisher}
                      className="gap-1"
                    >
                      <Plus size={14} aria-hidden="true" />
                      Ekle
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Ders</span>
                  <select
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                    className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-2.5 text-base text-panel-text outline-none focus:border-panel-accent focus:ring-2 focus:ring-panel-accent/20"
                  >
                    <option value="">Ders seçin</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Sınıf</span>
                  <select
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-2.5 text-base text-panel-text outline-none focus:border-panel-accent focus:ring-2 focus:ring-panel-accent/20"
                  >
                    <option value="">Sınıf seçin</option>
                    {BOOKSHELF_GRADE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}. Sınıf
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!isSimpleContentMode ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Kaynak Tipi</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-2.5 text-base text-panel-text outline-none focus:border-panel-accent focus:ring-2 focus:ring-panel-accent/20"
                  >
                    <option value="">Tip seçin</option>
                    {BOOKSHELF_RESOURCE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!isSimpleContentMode && type === 'soru_bankasi' ? (
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
            </div>
          </div>
        )}

        <div className="sticky -bottom-5 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-panel-border bg-panel-surface py-4 sm:-bottom-7">
        <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-panel-text hover:bg-panel-border/20">Vazgeç</button>
        <Button
          type="submit"
          disabled={saving || subjects === null || publishers === null || students === null}
          size="md"
          className="gap-2"
        >
          {saving ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Kitabı Ekle'}
          {!saving && <ArrowRight size={16} aria-hidden="true" />}
        </Button>
        </div>
      </form>
    </div>
  )
}
