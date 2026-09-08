import { ChildProfilePreview, ParentBooksPreview, PastResultsPreview, ParentBookMetricsPreview, ParentAssignmentPreview, ParentTeachersPreview, ParentFollowupPreview } from './ParentSetupPreview'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Download, Pause, Play, NotebookPen, Check, TrendingUp, CalendarDays, ClipboardCheck, Camera } from 'lucide-react'

const defaultTopics = ['Haftalık plan', 'Günlük görevler', 'Optik sonuç girişi', 'Kaynak başarısı', 'Tamamlanma oranı', 'Dijital hata defteri', 'Gelişim analizi']
const parentTopics = ['Çocuk profili', 'Kaynak hazırlığı', 'Geçmiş testler', 'Kaynak durumu', 'Plan ve görev', 'Özel öğretmenler', 'Günlük takip', 'Hata defteri', 'Gelişim analizi']
const content = {
  student: [
    ['Haftam belli, sıradaki adımım net.', 'Haftalık Plan’da derslerini ve çalışma görevlerini gör.', 'Öğretmenin veya velinin planladığı çalışmaları gün ve saatleriyle takip et; ne çalışacağını aklında tutmak zorunda kalma.'],
    ['Bugünkü görevimi açıyorum.', 'Bugün ekranından kaynağını ve çalışacağın testi gör.', 'Kitabından çalış, ardından görevdeki Tamamla adımına geç. Planlanan çalışma, kaydedilebilir bir sonuca dönüşsün.'],
    ['Çalışmam bitti, cevaplarımı giriyorum.', 'Tamamla → optik form → cevapları işaretle → Kaydet.', 'Cevap anahtarı olan testte cevaplarını işaretleyerek doğru, yanlış ve boşlarını gör. Yanlış sorularına fotoğraf ekleyip tekrar için sakla.'],
    ['Kitabımda ne kadar başarılıyım?', 'Çözdüğün soruların sonucunu kaynak bazında gör.', 'Soru sayısının yanında doğruluğunu da takip et; hangi kaynağa yeniden dönmen gerektiğini fark et.'],
    ['Kitabımın ne kadarı bitti?', 'Tamamladığın testleri ve kalan yolu birlikte gör.', 'Büyük bir kitabı küçük adımlara böl. Nerede kaldığını bilerek sıradaki çalışmana başla.'],
    ['Yanlışlarım, tekrar planım.', 'Sorunu fotoğrafla, hata nedenini seç, tekrar için not al.', 'Yalnızca yanlış soruyu değil, neden yanlış yaptığını da kaydet. Fotoğrafın, hata nedenin ve notunla daha bilinçli tekrar yap.'],
    ['Hangi konuda gelişiyorum?', 'Konu bazında başarı değişimini takip et.', 'İlerlemeni fark et, zorlandığın konuları gör ve çalışmanı ihtiyacına göre şekillendir.'],
  ],
  parent: [
    ['Önce çocuğunun profilini oluştur.', 'Çocuklarım’dan okul ve sınıf bilgilerini tamamla.', 'Kitapları, çalışma planını ve gelişim verilerini çocuğuna ait bir alanda bir araya getir.'],
    ['Kullandığı kaynakları hazırla.', 'Kütüphaneden seç, çocuğunun kitaplığına ekle.', 'Konu ve testleriyle hazır kaynaklar üzerinden çalışmayı planla. Bulamadığın kitap için özel kaynak oluşturabilir veya ekleme talebi gönderebilirsin.'],
    ['Önceden çözdüğü testler de kaybolmasın.', 'Kitaplık’tan tamamlanmış testi aç, cevaplarını gir ve kaydet.', 'Sisteme başlamadan önce yapılan çalışmaları da görünür kıl. Yeni görev atamadan, kitaptaki geçmiş cevapları girerek mevcut ilerlemeyi kayda al.'],
    ['Ne kadarı bitti, ne kadar başarılı?', 'Girilen cevaplar iki ayrı oranı görünür kılar.', 'Kaynağın tamamlanma oranıyla ne kadar çalışıldığını, başarı oranıyla bu çalışmanın sonucunu birlikte gör. Sonraki planı mevcut duruma göre oluştur.'],
    ['Haftasını planla, sıradaki görevi ata.', 'Haftalık Plan’da gün, saat, kaynak ve test seç.', 'Kalan çalışmaları ulaşılabilir günlük görevlere böl. Verdiğin görev öğrencinin planında yer alsın; ne zaman, hangi kitaptan çalışacağı netleşsin.'],
    ['Varsa özel öğretmenlerini de dahil et.', 'Öğretmeni çocuğun ve takip edeceği kaynaklarla eşleştir.', 'Panel erişimi vererek öğretmenle aynı çalışmalar üzerinden takip yap. Özel öğretmen bulunması şart değil; sistemi öğretmen eklemeden de kullanabilirsin.'],
    ['Görevden sonuca, süreci takip et.', 'Bugün ekranında tamamlanan çalışmayı ve cevap sonucunu gör.', 'Önceki kayıtlarla yeni çalışmalar bir araya gelsin. Hem kitapta ilerlemeyi hem başarıyı görerek çocuğuna ihtiyacı olan noktada destek ol.'],
    ['Yanlışın nedenini birlikte anlamlandır.', 'Soru fotoğrafını, hata nedenini ve öğrenci notunu incele.', 'Bilgi eksikliği mi, dikkat hatası mı? Çocuğunun kaydettiği hata analizinden yararlanarak tekrar ihtiyacını somut sorular üzerinden konuş.'],
    ['Gelişim analizinden yeni plana geç.', 'Ders ve konu bazında değişimi zaman içinde takip et.', 'Tek bir test yerine biriken sonuçları değerlendir. Gelişen alanları fark et; tekrar gereken konular için yeni görevler planla ve varsa öğretmeniyle paylaş.'],
  ],
  teacher: [
    ['Öğrencine kaynak üzerinden görev planla.', 'Öğrenci, kitap, test, gün ve saat: çalışma netleşsin.', 'Öğrencinin haftalık düzenine uygun görevler ver. Bir sonraki derse kadar ne çalışacağını somutlaştır.'],
    ['Verdiğin görevi dersler arasında takip et.', 'Öğrencinin görevini ve tamamlanma durumunu incele.', 'Ödevin hangi aşamada olduğunu gör; tamamlanan çalışmaların sonuçlarını kontrol ederek ders hazırlığını yap.'],
    ['Optik sonuçtan eksik konuya ulaş.', 'Öğrencinin kaydettiği cevapları soru bazında incele.', 'Doğru, yanlış ve boşları gör; hatalı sorular üzerinden tekrar ihtiyacını belirle ve görevi kontrol edildi olarak işaretle.'],
    ['Kaynak sonuçlarından ders odağına.', 'Öğrencinin testlerini doğru, yanlış ve boşlarıyla incele.', 'Hangi testlerde zorlandığını önceden gör; bir sonraki dersin odağını sonuçlara göre belirle.'],
    ['Verdiğiniz çalışma ne kadar ilerledi?', 'Öğrencilerinin kaynak ilerlemesini karşılaştır.', 'Tamamlanan ve kalan testleri görerek her öğrenci için ulaşılabilir yeni görevler planla.'],
    ['Bir sonraki dersin soruları hazır.', 'Hata defterinden konuya özel tekrar hazırlığı yap.', 'Hatalı soruları incele, ortak eksikleri belirle ve ders süresini öğrencinin ihtiyaçlarına ayır.'],
    ['Konu analizinden kişisel yol haritasına.', 'Öğrencilerinin güçlü ve gelişime açık alanlarını gör.', 'Sınıf Analizi ile genel durumu değerlendir; her öğrencinin sonraki çalışmasını kendi eksiğine göre planla.'],
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
  const [playing, setPlaying] = useState(false)
  const [visible, setVisible] = useState(false)
  const root = useRef(null)
  const touchStart = useRef(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!playing || !visible) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setSlide(current => (current + 1) % topics.length)
    }, 6500)
    return () => window.clearInterval(timer)
  }, [playing, visible, slide, topics.length])
  function select(index) { setSlide((index + topics.length) % topics.length); setPlaying(false) }
  const [title, subtitle] = content[role][slide]
  const visuals = role === 'parent' ? [<ChildProfilePreview />, <ParentBooksPreview />, <PastResultsPreview />, <ParentBookMetricsPreview />, <ParentAssignmentPreview />, <ParentTeachersPreview />, <ParentFollowupPreview />, <Mistakes role={role} />, <Analysis role={role} />] : [<WeeklyPlan role={role} />, <DailyTasks role={role} />, <OpticalResults role={role} />, <BookSuccess role={role} />, <Completion role={role} />, <Mistakes role={role} />, <Analysis role={role} />]
  return <div className={`role-preview-wrap rp-carousel rp-${role}`} ref={root} role="region" aria-roledescription="slayt gösterisi" aria-label={`${name} panel özellikleri`} onFocusCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !event.target.closest('.rp-play')) setPlaying(false) }} onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY } }} onTouchEnd={event => { if (!touchStart.current) return; const dx = event.changedTouches[0].clientX - touchStart.current.x; const dy = event.changedTouches[0].clientY - touchStart.current.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) select(slide + (dx < 0 ? 1 : -1)); touchStart.current = null }}>
    <div aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
      <div className="rp-slide" role="group" aria-roledescription="slayt" aria-label={`${slide + 1} / ${topics.length} · ${topics[slide]}`}>
        <div className="rp-story-heading">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="rp-story-stage">
          <div className="rp-panel-toolbar">
            <label className="rp-step-picker"><span>Tüm adımlar</span><select aria-label="Tüm adımlar" value={slide} onChange={event => select(Number(event.target.value))}>{topics.map((topic, i) => <option key={topic} value={i}>{i + 1} / {topics.length} · {topic}</option>)}</select></label>
            <div className="rp-panel-arrows">
              <button type="button" onClick={() => select(slide - 1)} aria-label="Önceki panel görseli" title="Önceki adım"><ArrowLeft size={18} aria-hidden="true" /></button>
              <button type="button" onClick={() => select(slide + 1)} aria-label="Sonraki panel görseli" title="Sonraki adım"><ArrowRight size={18} aria-hidden="true" /></button>
              <button type="button" className="rp-play" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Otomatik geçişi durdur' : 'Otomatik geçişi başlat'} title={playing ? 'Durdur' : 'Oynat'}>{playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button>
            </div>
          </div>
          <div className="role-preview">
            <div className="role-preview-top"><span className="role-preview-brand">Tech<span>Coach</span></span><span className="role-example">{name} paneli · Örnek</span></div>
            <div className="rp-slide-visual">{visuals[slide]}</div>
          </div>
        </div>
      </div>
    </div>

    <p className="role-preview-caption">Temsili veriler ve örnek panel görünümleri.</p>
  </div>
}
