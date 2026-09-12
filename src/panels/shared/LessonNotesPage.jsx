import { useEffect, useRef, useState } from 'react'
import { Search, X, ChevronRight, BookOpen, ArrowUpRight, Sparkles, Printer } from 'lucide-react'
import { authRequest } from '../../services/authClient'
import { printLessonNote } from '../../utils/printLessonNote'
import { useAuth } from '../../context/useAuth'

const field = 'w-full rounded-xl border border-panel-border bg-panel-surface p-3 text-panel-text'
const button = 'rounded-xl border border-panel-border px-4 py-2 text-sm font-medium hover:bg-panel-surface-soft disabled:opacity-50'
const emptyForm = { title: '', weekStart: '', weekEnd: '', topics: [], images: [] }
const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function LessonNotesPage({ admin = false }) {
  const { authUser } = useAuth()
  return <LessonNotesContent key={`${authUser?.id}:${admin}`} admin={admin} />
}

function NoteViewer({ note, onClose }) {
  const ref = useRef(null)
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState('')
  async function print() {
    setPrinting(true); setPrintError('')
    try { await printLessonNote(note) }
    catch (error) { setPrintError(error.message) }
    finally { setPrinting(false) }
  }
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} onClose={onClose} aria-label={note.title} className="fixed inset-0 z-50 m-auto h-[95dvh] w-[95vw] max-w-5xl overflow-auto rounded-2xl border border-panel-border bg-panel-surface p-4 text-panel-text backdrop:bg-black/60"><div className="sticky top-0 flex items-center justify-between gap-3 bg-panel-surface p-3"><h2 className="font-bold">{note.title}</h2><button disabled={printing} className={`${button} flex shrink-0 items-center gap-2`} onClick={print}><Printer size={16} />{printing ? 'Hazırlanıyor…' : 'Yazdır'}</button><button autoFocus className={button} onClick={() => ref.current.close()}>Kapat</button></div>{printError && <p role="alert" className="p-3 text-sm text-red-600">{printError}</p>}{note.images.map((img, i) => <figure key={i} className="mb-6"><figcaption className="p-2 text-center">Sayfa {i + 1} / {note.images.length}</figcaption><img src={img} alt={`${note.title} — sayfa ${i + 1}`} className="mx-auto h-auto w-full" /></figure>)}</dialog>
}

function LessonNotesContent({ admin }) {
  const { authUser } = useAuth()
  const [courses, setCourses] = useState([])
  const [selection, setSelection] = useState('')
  const [notes, setNotes] = useState([])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(null)
  const endpoint = admin ? '/api/panel/admin/lesson-notes' : '/api/panel/lesson-notes'
  const course = courses.find(c => `${c.grade}:${c.subjectId}` === selection)
  useEffect(() => {
    let ignore = false
    authRequest(endpoint).then(data => {
      if (ignore) return
      setCourses(data.courses)
      setSelection(data.courses[0] ? `${data.courses[0].grade}:${data.courses[0].subjectId}` : '')
      setLoading(false)
    }).catch(e => { if (!ignore) { setError(e.message); setLoading(false) } })
    return () => { ignore = true }
  }, [endpoint, authUser?.id])
  useEffect(() => {
    if (!selection) return
    let ignore = false
    const [grade, subjectId] = selection.split(':')
    authRequest(`${endpoint}?grade=${grade}&subjectId=${subjectId}`).then(data => {
      if (!ignore) { setNotes(data.notes); setError('') }
    }).catch(e => { if (!ignore) setError(e.message) })
    return () => { ignore = true }
  }, [endpoint, selection, revision])
  const choose = c => { setSelection(`${c.grade}:${c.subjectId}`); setNotes([]); setForm(null); setView(null) }
  async function upload(files) {
    setBusy(true); setError('')
    try {
      const images = await Promise.all(Array.from(files).map(file => new Promise((resolve, reject) => {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return reject(new Error('PNG, JPG veya WEBP seçin; sayfa başına en fazla 5 MB.'))
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Dosya okunamadı.'))
        reader.readAsDataURL(file)
      })))
      if (form.images.length + images.length > 20 || [...form.images, ...images].join('').length > 28000000) throw new Error('En fazla 20 sayfa ve toplam 20 MB yükleyebilirsiniz.')
      setForm(f => ({ ...f, images: [...f.images, ...images] }))
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await authRequest(endpoint, { method: 'POST', body: JSON.stringify({ ...form, topics: form.topics.map(t => t.trim()).filter(Boolean), grade: course.grade, subjectId: course.subjectId }) })
      setForm(null); setRevision(r => r + 1)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function remove(note) {
    if (!window.confirm(`“${note.title}” ders notları silinsin mi?`)) return
    setBusy(true)
    try { await authRequest(`${endpoint}/${note.id}`, { method: 'DELETE' }); setRevision(r => r + 1) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const search = query.trim().toLocaleLowerCase('tr-TR')
  const visibleNotes = notes.filter(note => [note.title, ...note.topics, dateLabel(note.weekStart), dateLabel(note.weekEnd)].join(' ').toLocaleLowerCase('tr-TR').includes(search))
  return <section className="space-y-3 text-panel-text">
    <label className="flex items-center gap-3 rounded-xl border border-panel-border bg-panel-surface px-3 py-2 focus-within:ring-2 focus-within:ring-panel-border">
      <Search size={18} className="shrink-0 text-panel-text-muted" /><span className="sr-only">Seçili derste konu veya alt başlık ara</span>
      <input type="search" value={query} onChange={e => { setQuery(e.target.value); setExpanded({}) }} placeholder="Bu derste konu, alt başlık veya tarih ara…" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" />
      {query && <button type="button" onClick={() => setQuery('')} aria-label="Aramayı temizle" className="p-1"><X size={16} /></button>}
    </label>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="text-xl font-bold">Ders Notları</h1><p className="mt-0.5 flex items-center gap-1.5 text-xs text-panel-text-muted"><Sparkles size={13} className="text-panel-warm" />{admin ? 'Bilfen · Haftalık ders içerikleri' : 'Bir konu seç, küçük bir tekrarla başla.'}</p></div>
      {courses.length > 0 && <label className="flex items-center gap-2 text-xs text-panel-text-muted">Sınıf<select disabled={busy} className="rounded-lg border border-panel-border bg-panel-surface px-2 py-1.5 text-sm text-panel-text" value={course?.grade || ''} onChange={e => choose(courses.find(c => c.grade === e.target.value))}>{[...new Set(courses.map(c => c.grade))].sort((a, b) => Number(a) - Number(b)).map(g => <option key={g} value={g}>{g}. sınıf</option>)}</select></label>}
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-300 p-3 text-red-600">{error}</p>}
    {loading ? <p>Yükleniyor…</p> : !courses.length ? <p>Bu alan için uygun Bilfen sınıfı veya ders bulunamadı.</p> : <>
      <div className="flex gap-1 overflow-x-auto border-b border-panel-border" aria-label="Dersler">{courses.filter(c => c.grade === course?.grade).map(c => <button key={c.subjectId} aria-pressed={c.subjectId === course?.subjectId} className={`shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${c.subjectId === course?.subjectId ? 'border-panel-warm bg-panel-accent-soft text-panel-warm' : 'border-transparent text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text'}`} disabled={busy} onClick={() => choose(c)}>{c.subjectName}</button>)}</div>
      {admin && <button className={button} disabled={busy} onClick={() => setForm({ ...emptyForm })}>+ Ana konu grubu ekle</button>}
      {form && <form onSubmit={save} className="space-y-4 rounded-2xl border border-panel-border bg-panel-surface p-5">
        <label className="block">Ana konu başlığı<input required maxLength={200} className={field} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Sözcükte Anlam ve Anlam Olayları" /></label>
        <div className="flex flex-wrap gap-4">{[['weekStart', 'Hafta başlangıcı'], ['weekEnd', 'Hafta bitişi']].map(([key, label]) => <label key={key}>{label}<input required type="date" className={field} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
        <label className="block">Alt başlıklar (her satıra bir başlık)<textarea required rows={5} className={field} value={form.topics.join('\n')} onChange={e => setForm({ ...form, topics: e.target.value.split('\n') })} placeholder={'Sözcükte Anlam (Gerçek, Yan, Mecaz, Terim Anlam)\nAnlam Özellikleri (Somut, Soyut, Nicel, Nitel)'} /></label>
        <label className="block">Ders notu görselleri (PNG, JPG, WEBP)<input disabled={busy} className={field} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e => { upload(e.target.files); e.target.value = '' }} /></label>
        <p className="text-sm text-panel-text-muted">Sayfa başına 5 MB, toplam 20 MB; en fazla 20 sayfa.</p>
        <div className="flex flex-wrap gap-3">{form.images.map((img, i) => <div key={i} className="w-36 space-y-2"><img src={img} alt={`Sayfa ${i + 1}`} className="h-40 w-full object-contain" /><span>Sayfa {i + 1}</span><div className="flex gap-2"><button type="button" disabled={busy || i === 0} aria-label={`Sayfa ${i + 1} öne taşı`} onClick={() => setForm(f => { const images = [...f.images]; [images[i - 1], images[i]] = [images[i], images[i - 1]]; return { ...f, images } })}>← Öne</button><button type="button" disabled={busy} onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, n) => n !== i) }))}>Kaldır</button></div></div>)}</div>
        <div className="flex gap-2"><button disabled={busy || !form.images.length} className={button}>{busy ? 'İşleniyor…' : 'Kaydet'}</button><button type="button" disabled={busy} className={button} onClick={() => setForm(null)}>Vazgeç</button></div>
      </form>}
      <div className="flex items-center justify-between text-xs text-panel-text-muted"><span>{course?.subjectName}</span><span aria-live="polite">{visibleNotes.length} konu grubu{search ? ' bulundu' : ' · Keşfet ve tekrar et'}</span></div>
      {!visibleNotes.length && <p className="rounded-xl bg-panel-surface-soft px-4 py-5 text-sm">{search ? 'Aramana uygun konu bulunamadı. Başka bir sözcük deneyebilirsin.' : 'Bu dersin notları eklendiğinde burada görünecek.'}</p>}
      <div className="overflow-hidden rounded-xl border border-panel-border bg-panel-surface">
      {visibleNotes.map((note, index) => {
        const open = expanded[note.id] ?? Boolean(search)
        return <article key={note.id} className="border-b border-panel-border last:border-b-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 transition-colors hover:bg-panel-surface-soft sm:flex-nowrap">
            <button type="button" aria-expanded={open} aria-controls={`topics-${note.id}`} onClick={() => setExpanded(previous => ({ ...previous, [note.id]: !open }))} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel-accent-soft text-xs font-semibold text-panel-warm">{String(index + 1).padStart(2, '0')}</span>
              <ChevronRight size={15} className={`shrink-0 text-panel-text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
              <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{note.title}</span><span className="text-[11px] text-panel-text-muted">{note.topics.length} alt başlık · {note.images.length} sayfa</span></span>
            </button>
            <span className="ml-11 text-[11px] text-panel-text-muted sm:ml-0 sm:shrink-0">{dateLabel(note.weekStart)} – {dateLabel(note.weekEnd)}</span>
            <button className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-panel-accent-soft px-3 py-2 text-xs font-semibold text-panel-warm transition-colors hover:brightness-95" onClick={() => setView(note)} aria-label={`${note.title}: ders notlarını göster`}><BookOpen size={14} />Notları aç<ArrowUpRight size={13} /></button>
            {admin && <div className="flex gap-2 text-xs"><button disabled={busy} onClick={() => setForm({ ...note })}>Düzenle</button><button disabled={busy} onClick={() => remove(note)}>Sil</button></div>}
          </div>
          {open && <ul id={`topics-${note.id}`} className="mb-2 ml-[3.75rem] mr-3 border-l border-panel-border pl-3">{note.topics.map((topic, i) => <li key={i} className="flex items-start gap-2 py-1 text-xs leading-5 text-panel-text-muted"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-panel-warm" />{topic}</li>)}</ul>}
        </article>
      })}
      </div>
    </>}
    {view && <NoteViewer note={view} onClose={() => setView(null)} />}
  </section>
}
