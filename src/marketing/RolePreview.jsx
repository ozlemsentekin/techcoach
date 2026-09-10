import { ChildProfilePreview, ParentBooksPreview, PastResultsPreview, ParentBookMetricsPreview, ParentAssignmentPreview, ParentTeachersPreview, ParentFollowupPreview } from './ParentSetupPreview'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Download, NotebookPen, Check, TrendingUp, CalendarDays, ClipboardCheck, Camera } from 'lucide-react'

const books = [['Matematik', 'Üslü ifadeler', 75, 60], ['Türkçe', 'Paragraf', 90, 80], ['Fen bilimleri', 'DNA ve genetik kod', 65, 40]]

function WeeklyPlan({ role }) {
  return <><div className="rp-summary"><strong><CalendarDays size={16} aria-hidden="true" /> {role === 'student' ? 'Haftalık Planım' : role === 'parent' ? 'Ece’nin Haftalık Planı' : 'Ece · Haftalık çalışma planı'}</strong><small>Örnek hafta · Okul, ders ve çalışma bir arada</small></div><div className="rp-week"><div className="rp-week-days">{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, i) => <span key={day} className={i === 1 ? 'selected' : ''}>{day}<b>{i + 7}</b></span>)}</div><div className="rp-schedule"><div><time>09.00</time><span>Okulda<small>Okul programı</small></span></div><div><time>16.00</time><span>Matematik · Özel ders<small>Öğretmenle çalışma</small></span></div><div className="highlight"><time>17.30</time><span>Üslü ifadeler · Test 4<small>Matematik Soru Bankası · 20 soru</small></span></div></div></div>{role !== 'student' && <div className="rp-assignment"><strong>{role === 'parent' ? 'Görev ekle' : 'Görev planla'}</strong><span>Kaynak → Test 4 → Salı, 17.30</span></div>}<div className="rp-callout">{role === 'student' ? 'Salı günkü görevim hazır. Zamanı geldiğinde Bugün ekranında görebilirim.' : 'Planlanan çalışma öğrencinin günlük görevlerine yansır.'}</div></>
}

function DailyTasks({ role }) {
  return <><div className="rp-filter-row"><span>Yapılacak</span><span>Devam Eden</span><span>Tamamlanan</span></div><div className="rp-task-card"><div className="rp-task-top"><span>17.30 · Matematik</span><span>{role === 'teacher' ? 'Tamamlandı' : 'Yapılacak'}</span></div><h5>Üslü ifadeler</h5><p>Matematik Soru Bankası</p><div className="rp-task-meta"><span>Test 4</span><span>20 soru</span></div><div className="rp-task-actions"><span>{role === 'student' ? 'Sayaç Başlat' : 'Görev detayları'}</span><strong>{role === 'teacher' ? 'Sonucu incele' : 'Tamamla'} <ArrowRight size={14} aria-hidden="true" /></strong></div></div><div className="rp-done-task"><ClipboardCheck size={18} aria-hidden="true" /><span>Türkçe · Paragraf<small>Test 6 · Tamamlandı</small></span><b>18 / 20 doğru</b></div><div className="rp-callout">{role === 'student' ? 'Önce kendi kitabından çalış. Testini bitirdiğinde Tamamla ile cevap girişine geç.' : role === 'parent' ? 'Tamamlanan görevde sonuçları gör; bekleyen çalışma için çocuğuna eşlik et.' : 'Tamamlanan görevde optik sonucu açarak öğrencinin cevaplarını kontrol et.'}</div></>
}

function OpticalResults({ role }) {
  const answers = ['A', 'C', 'D', 'B', 'C']
  return <><div className="rp-optical-heading"><strong>Optik Form · Test 4</strong><span>Üslü ifadeler · 5 soru</span></div><div className="rp-optical" aria-label="Optik cevap örneği: 1 A, 2 C, 3 D, 4 B, 5 C. Dördüncü soru yanlış, doğru cevap A.">{answers.map((answer, i) => <div className="rp-optical-row" key={i}><b>{i + 1}</b><div>{['A', 'B', 'C', 'D'].map(option => <span key={option} className={option === answer ? (i === 3 ? 'wrong' : 'marked') : i === 3 && option === 'A' ? 'correct' : ''}>{option}</span>)}</div>{i === 3 ? <Camera size={16} aria-label="Yanlış soruya fotoğraf ekle" /> : <span className="rp-optical-check">✓</span>}</div>)}</div><p className="rp-small-note">5 sorunun tamamı gösteriliyor · Sarı: doğru cevap · Kırmızı: yanlış cevap</p><div className="rp-result-strip"><span><b>4</b>Doğru</span><span><b>1</b>Yanlış</span><span><b>0</b>Boş</span></div><div className="rp-assignment"><strong>{role === 'student' ? 'Kaydet (5 soru)' : role === 'teacher' ? '✓ Kontrol edildi' : 'Optik sonucu · %80 başarı'}</strong><span>{role === 'student' ? 'Cevaplarını kaydet, görevini tamamla' : role === 'teacher' ? 'Yanlışları incele, sonraki dersi planla' : 'Görev tamamlandı; sonuçları birlikte incele'}</span></div><p className="rp-small-note">{role === 'student' ? 'Cevap anahtarı olmayan testlerde doğru, yanlış ve boş sayıları girilir.' : 'Öğrenci veya velinin kaydedebildiği sonuçların temsili gösterimi.'}</p></>
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

function MockExamPreview() {
  return <><div className="rp-summary"><strong>Deneme Sınavları</strong><small>Branş İzleme · Genel Deneme · Etüt</small></div><div className="rp-task-card"><h5>Matematik · Branş İzleme</h5><p>Örnek sınav · 20 soru</p><div className="rp-result-strip"><span><b>15</b>Doğru</span><span><b>3</b>Yanlış</span><span><b>2</b>Boş</span></div><div className="rp-assignment"><strong>14 net</strong><span>Yanlış ve boş soruları tekrar için sakla</span></div></div><div className="rp-callout">Sonuçları öğrenci veya veli kaydedebilir. Öğretmen, öğrencisinin sonuçlarını değerlendirebilir.</div></>
}

function getJourney(role) {
  if (role === 'parent') return {
    phases: [
      ['Çocuğunu Tanımla', 'Çocuğunuzun çalışma alanını oluşturun.', [0]],
      ['Çalışma Ortamını Hazırla', 'Kullandığı kaynak kitaplarını ekleyin.', [1, 2, 3]],
      ['Öğretmen İlişkisi Kur', 'Varsa özel öğretmenleriyle bağlantı kurun.', [4]],
      ['Planla ve İzle', 'Çalışmaları, denemeleri ve gelişimi takip edin.', [5, 6, 7, 8, 9]],
    ],
    steps: [
      ['Çocuk profili', 'Çocuğunuza ait bir çalışma alanı', 'Çocuğunuzun profilini ve sınıf bilgilerini tanımlayın. Birden fazla çocuğunuzun planını ve gelişimini ayrı ayrı takip edin.', ChildProfilePreview],
      ['Kaynak kitaplar', 'Kullandığı kitaplar bir arada', 'Kaynaklarını ekleyerek konu ve testleri çalışma planıyla buluşturun.', ParentBooksPreview],
      ['Geçmiş sonuçlar', 'Başlamak için sıfırdan başlamanız gerekmez', 'Daha önce çözülmüş testlerin sonuçlarını kaydederek mevcut çalışmalarını da takibe dahil edin.', PastResultsPreview],
      ['Kaynak ilerlemesi', 'Başarıyı ve tamamlanmayı birlikte görün', 'Kaynağın ne kadarının çalışıldığını ve çözülen sorulardaki başarıyı ayrı ayrı değerlendirin.', ParentBookMetricsPreview],
      ['Özel öğretmenler', 'Öğretmeniyle aynı süreci takip edin', 'Varsa özel öğretmenlerini ilişkilendirin. Çocuğunuzun kaynakları ve çalışmaları üzerinden birlikte ilerleyin.', ParentTeachersPreview],
      ['Çalışma planı', 'Haftanın planı, günün görevi', 'Okul, özel ders ve bireysel çalışmaları bir arada planlayın. Çocuğunuz kitabından çalışırken siz süreci takip edin.', ParentAssignmentPreview],
      ['Paylaşımlı kullanım', 'Sonuçları siz veya çocuğunuz kaydedin', 'Çocuğunuz cihaz kullanmak zorunda değil. Veli profilinden “Öğrenciye geç” ile görevi tamamlayabilir; sistemi veri takibi ve analiz için kullanabilirsiniz. Aynı sonucu iki kez girmeniz gerekmez.', ParentFollowupPreview],
      ['Hata defteri', 'Yanlışlar bir sonraki çalışmaya yol göstersin', 'Soru fotoğraflarını ve hata notlarını saklayın; tekrar edilmesi gereken sorulara birlikte dönün.', Mistakes],
      ['Deneme Sınavları', 'Deneme sonuçlarını bir arada takip edin', 'Branş İzleme, Genel Deneme ve Etüt sonuçlarını kaydedin. Doğru, yanlış, boş ve net bilgileriyle sınav performansını değerlendirin.', MockExamPreview],
      ['Gelişim Analizi', 'Verilerle sonraki adımı belirleyin', 'Derslerin doğruluk oranlarını, çalışma sonuçlarını ve kaynak ilerlemesini inceleyin. Destek gereken alanlara göre yeni plan oluşturun.', Analysis],
    ],
  }
  const student = role === 'student'
  return {
    phases: student ? [
      ['Planını Gör', 'Gününü ve haftanı düzenle.', [0, 1]],
      ['Çalış ve Kaydet', 'Kitabından çalış, sonuçlarını paylaş.', [2]],
      ['Tekrar Et', 'Kaynaklarını ve yanlışlarını incele.', [3, 4, 5]],
      ['Gelişimini İzle', 'Denemelerini ve ilerlemeni gör.', [6, 7]],
    ] : [
      ['Planla', 'Kaynaklardan çalışma planı oluştur.', [0]],
      ['Takip Et', 'Görevleri ve sonuçlarını incele.', [1, 2]],
      ['Yön Ver', 'Kaynaklar ve yanlışlarla tekrar planla.', [3, 4, 5]],
      ['Değerlendir', 'Deneme ve gelişim verilerini yorumla.', [6, 7]],
    ],
    steps: [
      ['Haftalık plan', student ? 'Haftanı bir bakışta gör' : 'Öğrencinin sonraki çalışmasını planla', 'Okul, ders ve bireysel çalışma zamanlarını aynı planda takip edin.', WeeklyPlan],
      ['Günlük görevler', student ? 'Bugün ne çalışacağını bil' : 'Verilen çalışmanın durumunu gör', 'Günlük görevlerde kaynak, konu ve test bilgilerine ulaşın; tamamlanan çalışmaları takip edin.', DailyTasks],
      ['Sonuç girişi', 'Paylaşımlı kullanım, ortak takip', 'Sonuçları öğrenci veya veli kaydedebilir. Çocuk cihaz kullanmıyorsa veli kendi profilinden öğrenciye geçerek görevi tamamlayabilir. Öğretmen kaydedilen sonuçları inceleyebilir.', OpticalResults],
      ['Kaynak başarısı', 'Çözülen testlerin başarısını gör', 'Doğru, yanlış ve boş sayılarını inceleyerek hangi konularda desteğe ihtiyaç olduğunu belirleyin.', BookSuccess],
      ['Kaynak ilerlemesi', 'Kaynakta ne kadar ilerlediğini gör', 'Tamamlanan ve kalan testleri takip edin. Başarı oranıyla tamamlanma oranını birlikte değerlendirin.', Completion],
      ['Hata defteri', 'Yanlış sorulardan tekrar planına', 'Yanlış soruların fotoğraflarını ve hata notlarını saklayın; sonraki çalışmada bu sorulara dönün.', Mistakes],
      ['Deneme Sınavları', 'Sınav sonuçlarını takip et', 'Branş İzleme, Genel Deneme ve Etüt sonuçlarını doğru, yanlış, boş ve net bilgileriyle değerlendirin.', MockExamPreview],
      ['Gelişim Analizi', student ? 'Gelişimini gör, tekrar alanını seç' : 'Gelişime göre sonraki dersi şekillendir', student ? 'Çalışma sonuçlarını ve güçlü ya da tekrar gerektiren konularını gör. Sonuçları velin kaydetse de gelişimini takip edebilirsin.' : 'Öğrencilerin sonuçlarını ve sınıf analizini inceleyerek her öğrenci için farklı bir çalışma odağı belirleyin.', Analysis],
    ],
  }
}

export default function RolePreview({ role, name }) {
  const [selected, setSelected] = useState(0)
  const { phases, steps } = getJourney(role)
  const phaseIndex = phases.findIndex((phase) => phase[2].includes(selected))
  const [, title, description, Visual] = steps[selected]
  return (
    <div className="marketing-journey" role="region" aria-label={`${name} kullanım yol haritası`}>
      <nav className="mj-phases" aria-label={`${name} süreçleri`}>
        {phases.map(([label, detail, indices], index) => <button type="button" key={label} aria-current={phaseIndex === index ? 'step' : undefined} onClick={() => setSelected(indices[0])}><span className="mj-number">{index + 1}</span><span><strong>{label}</strong><small>{detail}</small></span></button>)}
      </nav>
      <nav className="mj-steps" aria-label={`${name} alt adımları`}>
        {phases[phaseIndex][2].map(index => <button type="button" key={steps[index][0]} aria-current={selected === index ? 'step' : undefined} onClick={() => setSelected(index)}>{steps[index][0]}</button>)}
      </nav>
      <div className="mj-card">
        <div className="mj-content">
          <div className="mj-copy" aria-live="polite" aria-atomic="true"><span className="mj-count">Adım {selected + 1} / {steps.length}</span><h3>{title}</h3><p>{description}</p><span className="mj-example-note">Temsili verilerle örnek {name.toLocaleLowerCase('tr')} paneli.</span></div>
          <div key={selected} className="role-preview" tabIndex={0} role="region" aria-label={`${name} örnek ekranı; uzun içerik kaydırılabilir`}><div className="role-preview-top"><span className="role-preview-brand">Tech<span>Coach</span></span><span className="role-example">{name} · Örnek</span></div><div className="rp-slide-visual"><Visual role={role} /></div></div>
        </div>
        <div className="mj-controls"><button type="button" disabled={selected === 0} onClick={() => setSelected(selected - 1)}><ArrowLeft size={18} aria-hidden="true" />Önceki</button><span>Adımları sırayla keşfet</span><button type="button" disabled={selected === steps.length - 1} onClick={() => setSelected(selected + 1)}>Sonraki<ArrowRight size={18} aria-hidden="true" /></button></div>
      </div>
    </div>
  )
}
