import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Camera, FileCheck2, GraduationCap, LineChart, ListChecks, School, Users } from 'lucide-react'
import { useAuth } from '../../../context/useAuth'
import { cachedGet } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import GuideFlow from '../../shared/GuideFlow'

const LINK_CLASS = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-4 py-2 text-sm font-semibold text-panel-blue hover:bg-panel-blue-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue'

export default function GettingStartedPage() {
  const { authUser } = useAuth()
  const [students, setStudents] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const headingRef = useRef(null)

  useEffect(() => {
    headingRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((data) => { if (!ignore) { setStudents(data.students || []); setError('') } })
      .catch((err) => { if (!ignore) setError(err.message) })
    return () => { ignore = true }
  }, [authUser?.id, retry])

  const student = students?.find((item) => item.id === selectedId) || students?.[0]
  const studentName = student?.fullName?.trim().split(/\s+/)[0] || 'Çocuğunuz'
  const profileRoute = student ? `/parent/students?action=profile&studentId=${encodeURIComponent(student.id)}` : '/parent/students'
  const childRoute = (action) => student ? `/parent/students?action=${action}&studentId=${encodeURIComponent(student.id)}` : '/parent/students'
  const route = (path) => student ? path : '/parent/students'
  const stages = [
    { id: 'profile', icon: Users, title: 'Çocuğunuzun çalışma alanını tanıyın', done: Boolean(student), body: student ? `${studentName} için profiliniz hazır. Yeniden çocuk eklemeniz gerekmiyor. Çocuklarım ekranındaki Detay alanından mevcut bilgilerini inceleyebilirsiniz.` : 'Çocuklarım ekranından çocuğunuzun profilini oluşturun. Sınıf bilgisi, ona uygun kaynakları seçmenize yardımcı olur.', tip: 'Birden fazla çocuğunuz varsa her birinin kaynaklarını ve çalışma planını ayrı takip edebilirsiniz.', cta: student ? 'Profil bilgilerini incele' : 'Çocuk profili oluştur', to: profileRoute },
    { id: 'school', icon: School, title: 'Okul ve sınıf bilgilerini tamamlayın', done: Boolean(student?.schoolName), body: 'Çocuklarım → Detay alanından okul bilgilerini kontrol edin. Okulu il ve ilçeye göre seçerek çocuğunuzun çalışma alanını tamamlayın.', tip: 'Okul ve kitap bilgileri başlangıç sürecinin parçasıdır. Eksik bilgileri bu ekranlardan tamamlayabilirsiniz.', cta: 'Okul bilgilerine git', to: profileRoute },
    { id: 'books', icon: BookOpen, title: 'Kütüphaneden kullandığı kitapları seçin', done: (student?.resourceCount || 0) > 0, body: 'Kitaplık ekranındaki “Kütüphaneden kitap seç” düğmesini açın. Çocuğunuzun kullandığı kaynakları ders ve yayınevine göre bulup seçin, ardından kaydedin.', tip: 'Atadığınız kitaplar Kitaplık’ta görünür. Buradan kitapların konu ve testlerine ulaşabilirsiniz.', cta: 'Kitaplığı aç', to: route('/parent/bookshelf') },
    { id: 'custom', icon: ListChecks, title: 'Aradığınız kaynak yoksa kitaplığınızı tamamlayın', body: 'Kitaplık’taki “Yeni Kitap Ekle” ile kendi özel kaynağınızı oluşturabilirsiniz. Kitabın sisteme eklenmesini istiyorsanız “Kitap Ekleme Talebi Oluştur” seçeneğini kullanın.', tip: 'Talep için kitabın kapak, içindekiler ve cevap anahtarı görsellerini hazırlayın. Gönderdiğiniz talebin durumunu Taleplerim ekranından takip edin.', cta: 'Kitaplık seçeneklerini aç', to: route('/parent/bookshelf') },
    { id: 'teachers', icon: GraduationCap, title: 'Özel ders öğretmenlerini ekleyin', optional: true, body: 'Çocuklarım → Öğretmenler alanından özel ders öğretmenini ekleyin. Öğretmen bilgilerini ve verdiği dersleri tanımlayın.', tip: 'Özel ders öğretmeni yoksa bu adımı atlayabilirsiniz; plan ve gelişim takibini kendiniz sürdürebilirsiniz.', cta: 'Öğretmenleri yönet', to: childRoute('teachers') },
    { id: 'access', icon: Users, title: 'Öğretmen, çocuk ve kaynakları eşleştirin', optional: true, body: 'Öğretmenin hangi çocuğunuzla ve hangi kaynaklarla çalışacağını belirleyin. Öğretmenler alanındaki erişim seçenekleriyle öğretmene panel erişimi verebilirsiniz.', tip: 'Bu eşleştirme, öğretmenle aynı kaynaklar üzerinden çalışma takibi yapmanızı sağlar.', cta: 'Öğretmen erişimini incele', to: childRoute('teachers') },
    { id: 'work', icon: ListChecks, title: 'İlk çalışmayı planlayın', body: 'Yeni çalışma için Bu Hafta ekranında bir gün seçin ve görev ekleyin. Çocuğunuz çalışmasını kitap ve defter üzerinden yapabilir; görev takibi için onun telefon veya tablet kullanması gerekmez.', tip: 'TechCoach paylaşımlı bir çalışma alanıdır. Görev sonuçlarını öğrenci de veli de kaydedebilir; sonuç girişini kimin yapacağını birlikte belirleyin.', cta: 'İlk çalışmayı planla', to: route(`/parent/weekly-plan?studentId=${encodeURIComponent(student?.id || '')}`), secondary: { label: 'Geçmiş sonuçlar için kitaplığı aç', to: route('/parent/bookshelf') } },
    { id: 'results', icon: Users, title: 'Sonuçları öğrenci de veli de girebilir', body: 'Aynı görevin sonucunu iki kez girmeniz gerekmez. Öğrenci kendi panelinden görevi tamamlayabilir; veli de kendi hesabından öğrenci sayfasına geçerek onun adına sonucu kaydedebilir.', options: [
      { title: 'Öğrenci kullanıyorsa', body: 'Öğrenci kendi panelinde görevi açar, çalışmasını bitirir ve doğru, yanlış, boş bilgilerini kaydederek görevi tamamlar.' },
      { title: 'Veli takip ediyorsa', body: 'Sağ üstteki profil menüsü → Öğrenciye geç → ilgili görev → Görevi tamamla. Çocuğunuzun kağıt üzerinde yaptığı çalışmanın sonuçlarını siz kaydedebilirsiniz.' },
    ], tip: 'Çocuğunuz telefon veya tablet kullanmıyorsa tüm veri girişini siz üstlenebilirsiniz. Böylece TechCoach’u çalışma sonuçlarını toplamak ve gelişimi analiz etmek için kullanırsınız.', cta: 'Bugün ekranını aç', to: route('/parent/dashboard') },
    { id: 'mistakes', icon: Camera, title: 'Yanlış soruları tekrar çalışın', body: 'Sonuçları kaydeden kişi, yanlış soruların fotoğraflarını da ekleyebilir. Hata Defteri’nde bu sorulara geri dönerek çocuğunuzla tekrar çalışın.', tip: 'Çocuğunuz soruyu kağıt üzerinde yeniden çözebilir; fotoğraf ve sonuç takibini siz yapabilirsiniz.', cta: 'Hata defterini aç', to: route(`/parent/mistakes?studentId=${encodeURIComponent(student?.id || '')}`) },
    { id: 'mock-exams', icon: FileCheck2, title: 'Deneme Sınavları ile sınav sonuçlarını takip edin', body: 'Deneme Sınavları modülünde Branş İzleme, Genel Deneme ve Etüt sonuçlarını kaydedin. Derslerin doğru, yanlış ve boş sayılarını girerek netleri inceleyin; yanlış ve boş soruların görsellerini ekleyin.', tip: 'Branş İzleme tek derslik 20 soruluk sonuçlar, Genel Deneme LGS dersleri, Etüt ise soru sayısını belirlediğiniz tek derslik çalışmalar içindir. Sonucu veli veya öğrenci kaydedebilir.', cta: 'Deneme sınavlarını aç', to: route(`/parent/mock-exams?studentId=${encodeURIComponent(student?.id || '')}`) },
    { id: 'progress', icon: LineChart, title: 'Gelişim Analizi ile sonraki çalışmaya karar verin', body: 'Gelişim Analizi’nde derslerin genel başarı ortalamasını, doğruluk oranlarını, çalışma emeğini ve kaynak ilerlemesini birlikte inceleyin. Hangi dersin desteğe ihtiyaç duyduğunu belirleyerek sonraki haftanın planını oluşturun.', tip: 'Sonuçları ister siz ister çocuğunuz girsin, değerlendirdiğiniz çalışma verileri aynı öğrenciye aittir. Başarı oranı ile kitap tamamlama oranı farklıdır; düzenli sonuç kaydı analizi daha anlamlı hale getirir.', cta: 'Gelişim analizini aç', to: route(`/parent/progress?studentId=${encodeURIComponent(student?.id || '')}`) },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-panel-warm">Veli rehberi</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-bold text-panel-text outline-none sm:text-3xl">Başlangıç rehberi</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-panel-text-muted">Çalışmayı birlikte planlayın, sonuçları siz veya çocuğunuz kaydedin, gelişimi izleyin. Çocuğunuzun cihaz kullanması gerekmez; sistemi veli olarak veri takibi ve analiz için de kullanabilirsiniz.</p>
      </header>

      {error ? <div role="alert" className="panel-card p-5"><p className="text-sm text-panel-text">Rehber için çocuk bilgileri yüklenemedi: {error}</p><Button className="mt-3 min-h-11" onClick={() => setRetry((value) => value + 1)}>Yeniden dene</Button></div> : students === null ? <LoadingState label="Rehber hazırlanıyor..." /> : <>
        {students.length > 1 ? (
          <label className="flex flex-wrap items-center gap-3 text-sm font-semibold text-panel-text">
            Rehberdeki çocuk
            <select value={student.id} onChange={(event) => setSelectedId(event.target.value)} className="min-h-11 max-w-full rounded-xl border border-panel-border bg-panel-surface px-3">
              {students.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
          </label>
        ) : null}
        <GuideFlow phases={[
          { title: 'Çocuğunu Tanımla', description: 'Çocuğunuzu sisteme tanımlayın.', icon: Users, steps: [0, 1] },
          { title: 'Çalışma Ortamını Hazırla', description: 'Kaynak kitaplarını ekleyerek çalışma ortamını hazırlayın.', icon: BookOpen, steps: [2, 3] },
          { title: 'Öğretmen İlişkisi Kur', description: 'Varsa özel öğretmenleriyle bağlantı kurun.', icon: GraduationCap, steps: [4, 5] },
          { title: 'Planla ve İzle', description: 'Çalışma planını oluşturun ve gelişimini takip edin.', icon: LineChart, steps: [6, 7, 8, 9, 10] },
        ]} steps={stages.map((stage, index) => ({
          ...stage,
          shortTitle: ['Çocuk profili', 'Okul bilgileri', 'Kitap seçimi', 'Özel kaynak', 'Öğretmenler', 'Erişim', 'İlk çalışma', 'Sonuçları kim girer?', 'Hata defteri', 'Deneme Sınavları', 'Gelişim Analizi'][index],
          cta: !student && stage.id !== 'profile' ? 'Önce çocuk profilini oluştur' : stage.cta,
          secondary: student ? stage.secondary : undefined,
        }))} />
        <details className="panel-card p-5 sm:p-6">
          <summary className="cursor-pointer font-semibold text-panel-text">Kim, hangi hesapla giriş yapacak?</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-panel-surface-soft p-4"><h3 className="font-bold text-panel-text">Siz: veli hesabı</h3><p className="mt-2 text-sm leading-7 text-panel-text-muted">Kayıt olurken verdiğiniz kendi telefon numaranızla giriş yapın. İlk giriş şifresi bu numaranın son 6 hanesidir. Sistem, panele geçmeden önce yeni şifre belirlemenizi ister. Sonraki girişlerde kendi belirlediğiniz şifreyi kullanın.</p></div>
            <div className="rounded-xl bg-panel-surface-soft p-4"><h3 className="font-bold text-panel-text">Çocuğunuz: öğrenci hesabı</h3><p className="mt-2 text-sm leading-7 text-panel-text-muted">Çocuk profilini oluştururken girdiğiniz çocuğa ait telefon numarası, onun giriş numarasıdır. Başlangıç şifresi bu numaranın son 6 hanesidir. Çocuğunuz ilk bağımsız girişinde kendi yeni şifresini belirler; daha sonra öğrenci paneline bu şifreyle girer.</p></div>
          </div>
          <p className="mt-4 text-sm leading-7 text-panel-text"><strong>Giriş adresi herkes için aynı:</strong> Giriş Yap ekranına telefon numarası ve şifre yazılır; sistem hesabın veli, öğrenci veya öğretmen panelini açar.</p>
          <p className="mt-3 text-sm leading-7 text-panel-text-muted"><strong>Çocuğunuzun ekranını siz görmek isterseniz:</strong> Kendi veli hesabınızda sağ üstteki hesap menüsünden “Öğrenciye geç” seçeneğini kullanın. Çocuğunuzun şifresini girmeniz gerekmez. Bu geçiş çocuğunuzun bağımsız girişi sayılmaz ve onun şifresini değiştirmez.</p>
          <p className="mt-3 text-sm leading-7 text-panel-text-muted">Panel erişimi verdiğiniz yeni öğretmen de kendi telefon numarası ve başlangıç şifresiyle giriş yapar; ilk girişte yeni şifresini belirler. Her hesap kendi şifresini kullanır.</p>
        </details>
        <details className="panel-card p-5 sm:p-6">
          <summary className="cursor-pointer font-semibold text-panel-text">Çalışma kayıtları, denemeler ve destek</summary>
          <p className="mt-3 text-sm leading-7 text-panel-text-muted">Çalışma Geçmişi’nde tamamlanan görevleri ve sonuçlarını inceleyin. Deneme Sınavları’nda deneme kayıtlarını ve ders sonuçlarını takip edin. Sistemle ilgili soru ve önerilerinizi Taleplerim’den iletin; yanıtları aynı ekranda okuyabilirsiniz.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={route('/parent/study-history')} className={LINK_CLASS}>Çalışma geçmişini aç</Link>
            <Link to={route('/parent/mock-exams')} className={LINK_CLASS}>Deneme sınavlarını aç</Link>
            <Link to="/parent/requests" className={LINK_CLASS}>Taleplerimi aç</Link>
          </div>
        </details>
        <details className="panel-card p-5 sm:p-6"><summary className="cursor-pointer font-semibold text-panel-text">Günlük kullanım alışkanlığınız</summary><p className="mt-3 text-sm leading-7 text-panel-text-muted">Bugün ekranında görevleri gözden geçirin. Çalışma sonrası sonuçları siz veya çocuğunuz kaydedebilir. Aynı sonucu tekrar girmeden, yanlışları birlikte değerlendirin. Haftalık Plan’da sonraki çalışmaları düzenleyin; Gelişim Analizi’nde hangi alanlarda desteğe ihtiyaç olduğunu inceleyin.</p></details>
      </>}
    </div>
  )
}
