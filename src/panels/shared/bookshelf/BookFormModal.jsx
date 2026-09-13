import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardList, Plus, ScanLine, X } from 'lucide-react'
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
  const [step, setStep] = useState(0)
  const headingRef = useRef(null)
  const bodyRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])
  useEffect(() => {
    headingRef.current?.focus()
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [step])

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
  const [showNewPublisher, setShowNewPublisher] = useState(false)
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
      setShowNewPublisher(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingPublisher(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving || addingPublisher || loading) return
    if (step === 0) {
      setError('')
      setStep(1)
      return
    }
    const basicError = name.trim().length < 2 ? 'Kitap adı en az 2 karakter olmalı.'
      : !subjectId ? 'Ders seçin.' : !grade ? 'Sınıf seçin.'
        : !isEdit && selectedStudentIds.size === 0 ? 'En az bir öğrenci seçin.' : ''
    if (basicError) {
      setStep(1)
      setError(basicError)
      return
    }
    if (step === 1) {
      setError('')
      setStep(2)
      return
    }
    if (!publisherId && newPublisherName.trim().length < 2) return setError('Yayın evi seçin veya adını yazın.')
    if (!isSimpleContentMode && !type) return setError('Kaynak tipi seçin.')

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

  const loading = subjects === null || publishers === null || students === null
  const stepLabels = ['Kullanım', 'Kitap bilgileri', 'Tamamla']
  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape' && !saving) onClose()
    if (event.key !== 'Tab') return
    const focusable = [...formRef.current.querySelectorAll('button, input, select, [tabindex="0"]')]
      .filter((element) => !element.disabled && element.getClientRects().length)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm sm:p-4">
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true" aria-labelledby="book-form-title"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-panel-surface shadow-panel-1 sm:h-[640px] sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-3xl">
        <header className="shrink-0 border-b border-panel-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="book-form-title" className="text-xl font-bold text-panel-text">{isEdit ? 'Kitabı Düzenle' : 'Yeni Kitap Ekle'}</h2>
            <button type="button" disabled={saving} aria-label="Kapat" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-panel-accent"><X size={20} /></button>
          </div>
          <ol aria-label="Kitap ekleme adımları" className="mt-2 flex items-center gap-2">
            {stepLabels.map((label, index) => (
              <li key={label} aria-current={index === step ? 'step' : undefined} className={`flex min-w-0 flex-1 items-center gap-2 text-xs sm:text-sm ${index <= step ? 'font-semibold text-panel-text' : 'text-panel-text-muted'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${index <= step ? 'bg-panel-accent text-white' : 'bg-panel-surface-soft'}`}>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
                {label}
                {index < 2 && <span aria-hidden="true" className="hidden h-px flex-1 bg-panel-border sm:block" />}
              </li>
            ))}
          </ol>
        </header>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <h3 ref={headingRef} tabIndex={-1} className="mb-3 text-lg font-bold text-panel-text outline-none">{['Nasıl takip etmek istersiniz?', 'Hangi kitabı ekleyelim?', 'Son birkaç bilgi…'][step]}</h3>
          {error || loadError ? <p role="alert" className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error || loadError}</p> : null}
          {loading ? (loadError ? null : <LoadingState label="Form yükleniyor..." />) : <>
            {step === 0 && (
              <fieldset>
                <legend className="sr-only">Kitabı kullanma biçimi</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { value: 'structured', icon: <ScanLine size={20} />, title: 'İçerik ve cevap anahtarıyla', subtitle: 'Testleri ekle, optikle değerlendir' },
                    { value: 'simple', icon: <ClipboardList size={20} />, title: 'İçerik ve cevap anahtarı olmadan', subtitle: 'Görev ver, sonucu elle gir' },
                  ].map(({ value, icon, title, subtitle }) => (
                    <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 [@media(max-height:650px)]:p-2 transition-colors focus-within:ring-2 focus-within:ring-panel-accent focus-within:ring-offset-2 ${contentMode === value ? 'border-panel-accent bg-panel-accent-soft' : 'border-panel-border hover:bg-panel-surface-soft'}`}>
                      <input type="radio" name="book-content-mode" value={value} checked={contentMode === value} onChange={() => setContentMode(value)} className="sr-only" />
                      <span aria-hidden="true" className="shrink-0 text-panel-warm">{icon}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-snug text-panel-text">{title}</span><span className="mt-1 block text-xs text-panel-text-muted">{subtitle}</span></span>
                      <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${contentMode === value ? 'border-panel-accent bg-panel-accent text-white' : 'border-panel-text-muted'}`}>{contentMode === value && <Check size={13} />}</span>
                    </label>
                  ))}
                </div>
                <UsagePreview simple={isSimpleContentMode} />
              </fieldset>
            )}
            {step === 1 && <div className="space-y-4">
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

              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <ResourceImageField value={imageUrl} onChange={setImageUrl} compact size={56} showUrlToggle fit="contain" />
                  <span className="text-[10px] text-panel-text-muted">Kapak · İsteğe bağlı</span>
                </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
                <input
                  placeholder="Örn. 8. Sınıf Matematik Soru Bankası"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-2.5 text-base text-panel-text outline-none focus:border-panel-accent focus:ring-2 focus:ring-panel-accent/20"
                />
              </label>

              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Ders</span>
                  <select
                    aria-label="Ders"
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
                    aria-label="Sınıf"
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


              <p className="text-xs text-panel-text-muted">Bu kitap yalnızca seçilen öğrencilerin kitaplığında görünür.</p>
            </div>}
            {step === 2 && <div className="space-y-3">
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
                {!publisherId && !showNewPublisher && <button type="button" onClick={() => setShowNewPublisher(true)} className="self-start py-1 text-xs font-medium text-panel-warm underline underline-offset-2">Listede yok mu? Yeni yayın evi ekle</button>}
                {!publisherId && showNewPublisher ? (
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

              {!isSimpleContentMode ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Kaynak Tipi</span>
                  <select
                    aria-label="Kaynak Tipi"
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

              <p className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-text">{isSimpleContentMode ? 'Hazır! Ekledikten sonra kitap üzerinden görev verebilirsiniz.' : 'Sonraki adım: Konu, test ve cevap anahtarı ekleme.'}</p>
            </div>}
          </>}
        </div>

        <div data-book-form-footer className="flex shrink-0 items-center justify-between gap-3 border-t border-panel-border bg-panel-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <Button variant="ghost" disabled={saving || addingPublisher} className="h-11" onClick={() => { if (step === 0) onClose(); else { setError(''); setStep(step - 1) } }}>
            {step > 0 && <ArrowLeft size={16} aria-hidden="true" />}{step === 0 ? 'Vazgeç' : 'Geri'}
          </Button>
          <span className="text-xs text-panel-text-muted">{step + 1} / 3</span>
          <Button type="submit" disabled={saving || addingPublisher || loading} className="h-11 min-w-28">
            {saving ? 'Kaydediliyor…' : step < 2 ? 'Devam' : isEdit ? 'Kaydet' : 'Kitabı Ekle'}
            {!saving && <ArrowRight size={16} aria-hidden="true" />}
          </Button>
        </div>
      </form>
    </div>
  )
}

function UsagePreview({ simple }) {
  return (
    <div aria-live="polite" className="mt-4 [@media(max-height:650px)]:mt-2 rounded-2xl bg-panel-surface-soft p-3 sm:mt-5 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><p className="text-sm font-semibold text-panel-text">Kullanım akışı</p><span className="rounded-full bg-panel-surface px-2 py-1 text-[10px] text-panel-text-muted">Örnek akış</span></div>
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        <li className="min-w-0">
          <div aria-hidden="true" className="flex h-20 flex-col justify-center gap-1 rounded-xl border border-panel-border bg-panel-surface p-2 sm:h-24 [@media(max-height:650px)]:h-14">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-panel-text"><BookOpen size={12} />{simple ? 'Matematik' : 'Konu / Test'}</div>
            <div className="rounded bg-panel-surface-soft p-1 text-[10px] text-panel-text">{simple ? 'Sayfa 20–25' : 'Kesirler · Test 1'}</div>
            {!simple && <div className="flex gap-1">{['1 A', '2 C', '3 B'].map(answer => <span key={answer} className="rounded bg-panel-accent-soft px-1 text-[9px] text-panel-warm">{answer}</span>)}</div>}
          </div>
          <p className="mt-2 text-xs font-semibold text-panel-text">1. {simple ? 'Görev ver' : 'İçeriği hazırla'}</p>
          <p className="mt-1 text-[11px] leading-snug text-panel-text-muted [@media(max-height:650px)]:hidden">{simple ? 'Çalışılacak sayfaları seç' : 'Konu, test ve cevapları ekle'}</p>
        </li>
        <li className="min-w-0">
          <div aria-hidden="true" className="flex h-20 flex-col items-center justify-center gap-2 rounded-xl border border-panel-border bg-panel-surface p-2 sm:h-24 [@media(max-height:650px)]:h-14">
            {simple ? <><ClipboardList size={23} className="text-panel-warm" /><span className="text-[10px] text-panel-text">Çalışma tamamlandı ✓</span></> : <><ScanLine size={28} className="text-panel-warm" /><span className="text-[10px] text-panel-text">A ● C D</span></>}
          </div>
          <p className="mt-2 text-xs font-semibold text-panel-text">2. {simple ? 'Öğrenci çözsün' : 'Optikle oku'}</p>
          <p className="mt-1 text-[11px] leading-snug text-panel-text-muted [@media(max-height:650px)]:hidden">{simple ? 'Öğrenci kitaptan çalışır' : 'Çözülen testin cevaplarını okut'}</p>
        </li>
        <li className="min-w-0">
          <div aria-hidden="true" className="flex h-20 flex-col justify-center gap-2 rounded-xl border border-panel-border bg-panel-surface p-2 sm:h-24 [@media(max-height:650px)]:h-14">
            <div className="flex justify-center gap-1 text-[10px] font-semibold"><span className="rounded bg-emerald-50 px-1 py-1 text-emerald-700">8 D</span><span className="rounded bg-rose-50 px-1 py-1 text-rose-700">2 Y</span></div>
            {simple ? <div className="rounded border border-dashed border-panel-text-muted p-1 text-center text-[10px] text-panel-text">Elle giriş</div> : <div className="h-2 overflow-hidden rounded-full bg-rose-100"><div className="h-full w-4/5 rounded-full bg-emerald-500" /></div>}
          </div>
          <p className="mt-2 text-xs font-semibold text-panel-text">3. {simple ? 'Sonucu gir' : 'Sonucu gör'}</p>
          <p className="mt-1 text-[11px] leading-snug text-panel-text-muted [@media(max-height:650px)]:hidden">{simple ? 'Doğru ve yanlışı sen kaydet' : 'Sistem cevap anahtarıyla hesaplar'}</p>
        </li>
      </ol>
    </div>
  )
}
