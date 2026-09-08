import { ChildProfilePreview, ParentBooksPreview, PastResultsPreview, ParentBookMetricsPreview, ParentAssignmentPreview, ParentTeachersPreview, ParentFollowupPreview } from './ParentSetupPreview'
import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Download, NotebookPen, Check, TrendingUp, CalendarDays, ClipboardCheck, Camera } from 'lucide-react'

const defaultTopics = ['Haftalık plan', 'Günlük görevler', 'Optik sonuç girişi', 'Kaynak başarısı', 'Tamamlanma oranı', 'Dijital hata defteri', 'Gelişim analizi']
const parentTopics = ['Çocuk profili', 'Kaynak hazırlığı', 'Geçmiş testler', 'Kaynak durumu', 'Plan ve görev', 'Özel öğretmenler', 'Günlük takip', 'Hata defteri', 'Gelişim analizi']
const summaries = {
  student: [
    'Haftalık planınla ne çalışacağını bil.',
    'Bugünün görevini ve kaynağını gör.',
    'Cevaplarını gir, sonucunu kaydet.',
    'Kaynaklarındaki başarını gör.',
    'Kitabında ne kadar ilerlediğini gör.',
    'Sorunu fotoğrafla, hatanı not al.',
    'Gelişimini gör, eksiğine odaklan.',
  ],
  parent: [
    'Çocuğunun profilini oluştur.',
    'Kullandığı kitapları ekle.',
    'Geçmiş testlerin cevaplarını kaydet.',
    'İlerlemeyi ve başarıyı birlikte gör.',
    'Haftasını planla, görev ata.',
    'Varsa özel öğretmenini dahil et.',
    'Görevleri ve sonuçlarını takip et.',
    'Yanlışlarını ve nedenlerini incele.',
    'Gelişimine göre yeni plan oluştur.',
  ],
  teacher: [
    'Kaynağından haftalık görev planla.',
    'Verdiğin çalışmayı takip et.',
    'Cevaplarından eksiklerini gör.',
    'Test sonuçlarıyla derse hazırlan.',
    'Kalan testlere göre görev planla.',
    'Hatalı sorularla tekrar hazırla.',
    'Konu analizine göre yol göster.',
  ],
}

const books = [['Matematik', 'Üslü ifadeler', 75, 60], ['Türkçe', 'Paragraf', 90, 80], ['Fen bilimleri', 'DNA ve genetik kod', 65, 40]]

function WeeklyPlan({ role }) {
  return <><div className="rp-summary"><strong><CalendarDays size={16} aria-hidden="true" /> {role === 'student' ? 'Haftalık Planım' : role === 'parent' ? 'Ece’nin Haftalık Planı' : 'Ece · Haftalık çalışma planı'}</strong><small>Örnek hafta · Okul, ders ve çalışma bir arada</small></div><div className="rp-week"><div className="rp-week-days">{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, i) => <span key={day} className={i === 1 ? 'selected' : ''}>{day}<b>{i + 7}</b></span>)}</div><div className="rp-schedule"><div><time>09.00</time><span>Okulda<small>Okul programı</small></span></div><div><time>16.00</time><span>Matematik · Özel ders<small>Öğretmenle çalışma</small></span></div><div className="highlight"><time>17.30</time><span>Üslü ifadeler · Test 4<small>Matematik Soru Bankası · 20 soru</small></span></div></div></div>{role !== 'student' && <div className="rp-assignment"><strong>{role === 'parent' ? 'Görev ekle' : 'Görev planla'}</strong><span>Kaynak → Test 4 → Salı, 17.30</span></div>}<div className="rp-callout">{role === 'student' ? 'Salı günkü görevim hazır. Zamanı geldiğinde Bugün ekranında görebilirim.' : 'Planlanan çalışma öğrencinin günlük görevlerine yansır.'}</div></>
}

function DailyTasks({ role }) {
  return <><div className="rp-filter-row"><span>Yapılacak</span><span>Devam Eden</span><span>Tamamlanan</span></div><div className="rp-task-card"><div className="rp-task-top"><span>17.30 · Matematik</span><span>{role === 'teacher' ? 'Tamamlandı' : 'Yapılacak'}</span></div><h5>Üslü ifadeler</h5><p>Matematik Soru Bankası</p><div className="rp-task-meta"><span>Test 4</span><span>20 soru</span></div><div className="rp-task-actions"><span>{role === 'student' ? 'Sayaç Başlat' : 'Görev detayları'}</span><strong>{role === 'teacher' ? 'Sonucu incele' : 'Tamamla'} <ArrowRight size={14} aria-hidden="true" /></strong></div></div><div className="rp-done-task"><ClipboardCheck size={18} aria-hidden="true" /><span>Türkçe · Paragraf<small>Test 6 · Tamamlandı</small></span><b>18 / 20 doğru</b></div><div className="rp-callout">{role === 'student' ? 'Önce kendi kitabından çalış. Testini bitirdiğinde Tamamla ile cevap girişine geç.' : role === 'parent' ? 'Tamamlanan görevde sonuçları gör; bekleyen çalışma için çocuğuna eşlik et.' : 'Tamamlanan görevde optik sonucu açarak öğrencinin cevaplarını kontrol et.'}</div></>
}

function OpticalResults({ role }) {
  const answers = ['A', 'C', 'D', 'B', 'C']
  return <><div className="rp-optical-heading"><strong>Optik Form · Test 4</strong><span>Üslü ifadeler · 5 soru</span></div><div className="rp-optical" aria-label="Optik cevap örneği: 1 A, 2 C, 3 D, 4 B, 5 C. Dördüncü soru yanlış, doğru cevap A.">{answers.map((answer, i) => <div className="rp-optical-row" key={i}><b>{i + 1}</b><div>{['A', 'B', 'C', 'D'].map(option => <span key={option} className={option === answer ? (i === 3 ? 'wrong' : 'marked') : i === 3 && option === 'A' ? 'correct' : ''}>{option}</span>)}</div>{i === 3 ? <Camera size={16} aria-label="Yanlış soruya fotoğraf ekle" /> : <span className="rp-optical-check">✓</span>}</div>)}</div><p className="rp-small-note">5 sorunun tamamı gösteriliyor · Sarı: doğru cevap · Kırmızı: yanlış cevap</p><div className="rp-result-strip"><span><b>4</b>Doğru</span><span><b>1</b>Yanlış</span><span><b>0</b>Boş</span></div><div className="rp-assignment"><strong>{role === 'student' ? 'Kaydet (5 soru)' : role === 'teacher' ? '✓ Kontrol edildi' : 'Optik sonucu · %80 başarı'}</strong><span>{role === 'student' ? 'Cevaplarını kaydet, görevini tamamla' : role === 'teacher' ? 'Yanlışları incele, sonraki dersi planla' : 'Görev tamamlandı; sonuçları birlikte incele'}</span></div><p className="rp-small-note">{role === 'student' ? 'Cevap anahtarı olmayan testlerde doğru, yanlış ve boş sayıları girilir.' : 'Öğrencinin kaydettiği sonuçlar üzerinden temsili gösterim.'}</p></>
}

function Meter({ label, value, orange = false }) {
  return <div className={`rp-meter ${orange ? 'rp-meter-orange' : ''}`}><div><span>{label}</span><strong>%{value}</strong></div><div className="rp-meter-track"><span style={{ width: `${value}%` }} /></div></div>
}

function BookSuccess({ role }) {
  if (role === 'student') return <><div className="rp-book-spotlight"><div className="rp-book-cover"><BookOpen aria-hidden="true" /><span>MATEMATİK</span><strong>8</strong><small>Soru Bankası</small></div><div><span className="rp-overline">KAYNAK BAŞARIM</span><strong className="rp-big-number">%75</strong><p>Çözdüğüm 240 sorunun<br />180’i doğru</p></div></div><div className="rp-result-strip"><span><b>180</b>Doğru</span><span><b>48</b>Yanlış</span><span><b>12</b>Boş</span></div><div className="rp-callout">Üslü ifadeler · Son test: <strong>15 / 20 doğru</strong></div></>
  if (role === 'parent') return <><div className="rp-person">E <span><strong>Ece’nin kitaplığı</strong><small>3 kaynak · Kaynak bazında başarı</small></span></div>{books.map(([name, topic, success]) => <div className="rp-book-row" key={name}><BookOpen size={21} aria-hidden="true" /><div><strong>{name} Soru Bankası</strong><Meter label={topic} value={success} /></div></div>)}<div className="rp-callout">Fen bilimleri, destek için birlikte incelenebilir.</div></>
  return <><div className="rp-person">E <span><strong>Ece · Matematik Soru Bankası</strong><small>Test sonuçlarını incele</small></span></div><div className="rp-table"><div><strong>Test</strong><strong>D / Y / B</strong><strong>Başarı</strong></div>{[['Üslü ifadeler', '15 / 5 / 0', '%75'], ['Kareköklü ifadeler', '12 / 6 / 2', '%60'], ['Çarpanlar', '18 / 2 / 0', '%90']].map(row => <div key={row[0]}>{row.map(cell => <span key={cell}>{cell}</span>)}</div>)}</div><div className="rp-callout">Ders odağı: <strong>Kareköklü ifadeler</strong><br />6 yanlış ve 2 boş soruyu incele.</div></>
}

function Completion({ role }) {
  if (role === 'student') return <><div className="rp-completion-hero"><div className="rp-ring"><strong>%60<small>tamamlandı</small></strong></div><div><strong>Matematik<br />Soru Bankası</strong><p>12 / 20 test tamamlandı<br />8 test seni bekliyor</p></div></div><div className="rp-test-grid" aria-label="20 testin 12 tanesi tamamlandı">{Array.from({ length: 20 }, (_, i) => <span className={i < 12 ? 'done' : ''} key={i}>{i + 1}</span>)}</div><div className="rp-callout">Sıradaki adım: <strong>Test 13 · Kareköklü ifadeler</strong></div></>
  const rows = role === 'parent' ? books.map(([name, , , percent]) => [name, percent]) : [['Ece · Matematik', 60], ['Deniz · Matematik', 80], ['Arda · Matematik', 40]]
  return <><div className="rp-summary"><strong>{role === 'parent' ? 'Kitaplık ilerlemesi' : 'Öğrenci kaynak takibi'}</strong><small>{role === 'parent' ? 'Ece · Tamamlanan test / toplam test' : 'Matematik Soru Bankası · 20 test'}</small></div>{rows.map(([name, percent]) => <div className="rp-progress-row" key={name}><Meter label={name} value={percent} orange /><p>{percent / 5} / 20 test tamamlandı <span>{20 - percent / 5} test kaldı</span></p></div>)}<div className="rp-callout">{role === 'parent' ? 'Tamamlanma, kitabın ne kadarının çalışıldığını gösterir.' : 'Kalan testlere göre öğrencine yeni görev planla.'}</div></>
}

function Mistakes({ role }) {
  return <>
    <div className="rp-filter-row"><span>Matematik</span><span>Üslü ifadeler</span><span>Soru 4</span></div>
    <figure className="rp-question-photo">
      <div className="rp-photo-label"><Camera size={14} aria-hidden="true" /><span>{role === 'student' ? 'Çektiğim soru fotoğrafı' : 'Öğrencinin yüklediği fotoğraf'}</span><span>Fotoğraf</span></div>
      <img src="/marketing/mistake-question-photo.png" width="1536" height="1024" loading="lazy" alt="Kitaptan çekilmiş örnek soru fotoğrafı: 2 üzeri 3 çarpı 2 üzeri 4. Öğrenci yanlış olan B, 2 üzeri 12 seçeneğini kurşun kalemle daire içine almış." />
      <figcaption><span>İşaretlenen: <b>B</b></span><span>Doğru cevap: <b>A</b></span></figcaption>
    </figure>
    <div className="rp-mistake-analysis">
      <div className="rp-reason-heading"><strong>{role === 'student' ? 'Neden yanlış yaptım?' : 'Öğrencinin hata analizi'}</strong><span><Check size={12} aria-hidden="true" /> Kaydedildi</span></div>
      <div className="rp-reason-options" aria-label="Kaydedilen hata nedeni: Bilgi eksikliği">
        <span className="selected"><Check size={12} aria-hidden="true" /> Bilgi eksikliği</span><span>Dikkat hatası</span><span>Soruyu anlamadım</span>
      </div>
      <div className="rp-student-note"><NotebookPen size={15} aria-hidden="true" /><div><strong>{role === 'student' ? 'Kendime notum' : 'Öğrencinin notu'}</strong><p>Üsleri toplamak yerine çarptım. Aynı tabanlı üslü sayılarda çarpma kuralını tekrar edeceğim.</p></div></div>
    </div>
    <div className="rp-pdf"><Download size={18} aria-hidden="true" /><span>{role === 'student' ? 'Hata defterimi PDF olarak al' : role === 'parent' ? 'Yanlış soruları PDF olarak incele' : 'Tekrar sorularını PDF olarak al'}</span></div>
    <p className="rp-small-note">Örnek soru fotoğrafı ve öğrenci tarafından girilmiş temsili hata analizi.</p>
  </>
}

function Analysis({ role }) {
  if (role === 'teacher') return <><div className="rp-summary"><strong>Sınıf Analizi · Konu başarıları</strong><small>Her öğrenci için farklı bir çalışma odağı</small></div><div className="rp-table rp-heatmap"><div><strong>Öğrenci</strong><strong>Üslü<br />ifadeler</strong><strong>Kareköklü<br />ifadeler</strong></div>{[['Ece', 75, 60], ['Deniz', 90, 80], ['Arda', 55, 70]].map(([name, a, b]) => <div key={name}><strong>{name}</strong>{[a, b].map((v, i) => <span key={i} className={v < 70 ? 'needs-work' : 'strong-topic'}>%{v}</span>)}</div>)}</div><div className="rp-callout">Ece: kareköklü ifadeler<br />Arda: üslü ifadeler üzerine çalışma planla.</div></>
  return <><div className="rp-chart-heading"><div><span className="rp-overline">{role === 'student' ? 'ÜSLÜ İFADELER · BAŞARIM' : 'ECE · MATEMATİK BAŞARISI'}</span><strong>%75 <small><TrendingUp size={15} aria-hidden="true" /> +25 puan</small></strong></div></div><div className="rp-chart" aria-label="Dört haftalık başarı: yüzde 50, 60, 65, 75">{[50, 60, 65, 75].map((value, i) => <div key={i}><strong>%{value}</strong><span style={{ height: `${value * 1.4}px` }} /><small>{i + 1}. hafta</small></div>)}</div><div className="rp-analysis-topics"><span><b>Güçlü alan</b>Çarpanlar · %90</span><span><b>Tekrar alanı</b>Kareköklü ifadeler · %60</span></div><div className="rp-callout">{role === 'student' ? 'İlerlememi görüyorum; sıradaki odağım kareköklü ifadeler.' : 'Matematikteki gelişimi fark et; tekrar alanı için öğretmeniyle birlikte plan yap.'}</div></>
}

export default function RolePreview({ role, name }) {
  const topics = role === 'parent' ? parentTopics : defaultTopics
  const [slide, setSlide] = useState(0)
  const [dragX, setDragX] = useState(0)
  const gesture = useRef(null)
  function select(index) {
    setSlide((index + topics.length) % topics.length)
    setDragX(0)
  }
  function startDrag(event) {
    if (event.pointerType === 'mouse' || event.target.closest('button, select')) return
    gesture.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function moveDrag(event) {
    if (!gesture.current) return
    const dx = event.clientX - gesture.current.x
    const dy = event.clientY - gesture.current.y
    if (Math.abs(dx) > Math.abs(dy)) setDragX(Math.max(-65, Math.min(65, dx)))
  }
  function finishDrag(event) {
    if (!gesture.current) return
    const dx = event.clientX - gesture.current.x
    const dy = event.clientY - gesture.current.y
    gesture.current = null
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) select(slide + (dx < 0 ? 1 : -1))
    else setDragX(0)
  }
  const summary = summaries[role][slide]
  const visuals = role === 'parent' ? [<ChildProfilePreview />, <ParentBooksPreview />, <PastResultsPreview />, <ParentBookMetricsPreview />, <ParentAssignmentPreview />, <ParentTeachersPreview />, <ParentFollowupPreview />, <Mistakes role={role} />, <Analysis role={role} />] : [<WeeklyPlan role={role} />, <DailyTasks role={role} />, <OpticalResults role={role} />, <BookSuccess role={role} />, <Completion role={role} />, <Mistakes role={role} />, <Analysis role={role} />]
  return <div className={`role-preview-wrap rp-carousel rp-${role}`} role="region" aria-roledescription="slayt gösterisi" aria-label={`${name} panel özellikleri`}>
    <div aria-live="polite" aria-atomic="true">
      <div className="rp-slide" role="group" aria-roledescription="slayt" aria-label={`${slide + 1} / ${topics.length} · ${topics[slide]}`}>
        <div className="rp-story-heading">
          <p className="rp-step-summary">{summary}</p>
        </div>
        <div className="rp-story-stage">
          <div className="rp-process">
            <div className="rp-process-header"><span className="rp-process-number">{String(slide + 1).padStart(2, '0')}</span><label className="rp-process-picker"><span>{name} yolculuğu · {topics.length} adım</span><select aria-label="Tüm adımlar" value={slide} onChange={event => select(Number(event.target.value))}>{topics.map((topic, i) => <option key={topic} value={i}>{topic}</option>)}</select></label></div>
            <div className="rp-process-track" aria-label="Süreç adımları">{topics.map((topic, i) => <button type="button" key={topic} className={i <= slide ? 'reached' : ''} aria-current={slide === i ? 'step' : undefined} aria-label={`${i + 1}. adım: ${topic}`} onClick={() => select(i)} />)}</div>
          </div>
          <div className="rp-carousel-frame">
            <button className="rp-side-arrow rp-side-prev" type="button" onClick={() => select(slide - 1)} aria-label="Önceki panel görseli"><ArrowLeft size={20} aria-hidden="true" /></button>
            <div className="rp-swipe-area" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => { gesture.current = null; setDragX(0) }}>
          <div className="role-preview" style={{ transform: `translateX(${dragX}px)`, opacity: 1 - Math.abs(dragX) / 250 }}>

            <div className="role-preview-top"><span className="role-preview-brand">Tech<span>Coach</span></span><span className="role-example">{name} paneli · Örnek</span></div>
            <div className="rp-slide-visual">{visuals[slide]}</div>
          </div>
            </div>
            <button className="rp-side-arrow rp-side-next" type="button" onClick={() => select(slide + 1)} aria-label="Sonraki panel görseli"><ArrowRight size={20} aria-hidden="true" /></button>
          </div>
          <p className="rp-swipe-hint">Diğer adımlar için sağa veya sola kaydırın</p>
        </div>
      </div>
    </div>

    <p className="role-preview-caption">Temsili veriler ve örnek panel görünümleri.</p>
  </div>
}
