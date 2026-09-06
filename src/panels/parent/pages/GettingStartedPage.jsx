import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Camera, CheckCircle2, GraduationCap, LineChart, ListChecks, Repeat2, School, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../../../context/useAuth'
import { cachedGet } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'

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
    { id: 'work', icon: ListChecks, title: 'Geçmiş sonuçları girin veya ilk görevi planlayın', body: 'Daha önce çözülmüş testler için Kitaplık’tan ilgili kitabı ve testi açıp sonuçları girin. Yeni çalışma için Haftalık Plan’da bir gün seçin ve görev ekleyin.', tip: 'İlk gün için tek bir çalışma yeterli. Çalışma tamamlandığında doğru, yanlış ve boş sayılarını girerek ilerlemeyi kaydedin.', cta: 'İlk çalışmayı planla', to: route(`/parent/weekly-plan?studentId=${encodeURIComponent(student?.id || '')}`), secondary: { label: 'Geçmiş sonuçlar için kitaplığı aç', to: route('/parent/bookshelf') } },
    { id: 'progress', icon: Camera, title: 'Yanlışlardan öğrenin, gelişimi takip edin', body: 'Sonuç girerken yanlış soruların fotoğraflarını ekleyin. Hata Defteri’nde tekrar çalışılacak soruları, Kitaplık’ta başarı ve tamamlanma oranlarını, Gelişim Analizi’nde ilerlemeyi inceleyin.', tip: 'Başarı oranı ile kitap tamamlama oranı farklı şeyler anlatır: biri sonuçları, diğeri kaynakta ne kadar ilerlediğinizi gösterir. Veriler, çalışmalar kaydedildikçe anlam kazanır.', cta: 'Gelişim analizini aç', to: route('/parent/progress'), secondary: { label: 'Hata defterini aç', to: route(`/parent/mistakes?studentId=${encodeURIComponent(student?.id || '')}`) } },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="panel-card bg-gradient-to-br from-panel-blue-soft/60 via-panel-surface to-panel-accent-soft/40 p-5 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-bold text-panel-warm"><Sparkles size={16} aria-hidden="true" />TECHCOACH KULLANIM REHBERİ</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-bold text-panel-text outline-none sm:text-3xl">Başlangıç rehberi</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-panel-text-muted">Çalışma alanını hazırlayın, küçük bir hedefle başlayın ve sonuçları birlikte değerlendirin. Bu rehberden ihtiyacınız olan adıma istediğiniz zaman dönebilirsiniz.</p>
        <Link to={route('/parent/dashboard')} className={`${LINK_CLASS} mt-4`}>{student ? 'Bugün ekranına dön' : 'Çocuklarım ekranına git'}<ArrowRight size={16} aria-hidden="true" /></Link>
      </header>

      {error ? <div role="alert" className="panel-card p-5"><p className="text-sm text-panel-text">Rehber için çocuk bilgileri yüklenemedi: {error}</p><Button className="mt-3 min-h-11" onClick={() => setRetry((value) => value + 1)}>Yeniden dene</Button></div> : students === null ? <LoadingState label="Rehber hazırlanıyor..." /> : <>
        <section className="panel-card p-5 sm:p-6" aria-labelledby="account-access-title">
          <h2 id="account-access-title" className="text-xl font-bold text-panel-text">Kim, hangi hesapla giriş yapacak?</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-panel-surface-soft p-4"><h3 className="font-bold text-panel-text">Siz: veli hesabı</h3><p className="mt-2 text-sm leading-7 text-panel-text-muted">Kayıt olurken verdiğiniz kendi telefon numaranızla giriş yapın. İlk giriş şifresi bu numaranın son 6 hanesidir. Sistem, panele geçmeden önce yeni şifre belirlemenizi ister. Sonraki girişlerde kendi belirlediğiniz şifreyi kullanın.</p></div>
            <div className="rounded-xl bg-panel-surface-soft p-4"><h3 className="font-bold text-panel-text">Çocuğunuz: öğrenci hesabı</h3><p className="mt-2 text-sm leading-7 text-panel-text-muted">Çocuk profilini oluştururken girdiğiniz çocuğa ait telefon numarası, onun giriş numarasıdır. Başlangıç şifresi bu numaranın son 6 hanesidir. Çocuğunuz ilk bağımsız girişinde kendi yeni şifresini belirler; daha sonra öğrenci paneline bu şifreyle girer.</p></div>
          </div>
          <p className="mt-4 text-sm leading-7 text-panel-text"><strong>Giriş adresi herkes için aynı:</strong> Giriş Yap ekranına telefon numarası ve şifre yazılır; sistem hesabın veli, öğrenci veya öğretmen panelini açar.</p>
          <p className="mt-3 text-sm leading-7 text-panel-text-muted"><strong>Çocuğunuzun ekranını siz görmek isterseniz:</strong> Kendi veli hesabınızda sağ üstteki hesap menüsünden “Öğrenciye geç” seçeneğini kullanın. Çocuğunuzun şifresini girmeniz gerekmez. Bu geçiş çocuğunuzun bağımsız girişi sayılmaz ve onun şifresini değiştirmez.</p>
          <p className="mt-3 text-sm leading-7 text-panel-text-muted">Panel erişimi verdiğiniz yeni öğretmen de kendi telefon numarası ve başlangıç şifresiyle giriş yapar; ilk girişte yeni şifresini belirler. Her hesap kendi şifresini kullanır.</p>
        </section>
        <section className="panel-card p-5" aria-label="Çalışma alanınız">
          {students.length > 1 ? <label className="mb-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-panel-text">Rehberdeki çocuk<select value={student.id} onChange={(event) => setSelectedId(event.target.value)} className="min-h-11 max-w-full rounded-xl border border-panel-border bg-panel-surface px-3">{students.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label> : null}
          <p className="flex items-start gap-2 text-sm leading-6 text-panel-text"><CheckCircle2 size={20} className="mt-0.5 shrink-0 text-panel-blue" aria-hidden="true" />{student ? `${studentName} için çocuk profili mevcut. Aşağıdan ihtiyacınız olan adıma geçebilirsiniz.` : 'Henüz çocuk profili yok. İlk adımla başlayıp ardından okul ve kitap bilgilerini tamamlayın.'}</p>
        </section>
        <nav aria-label="Rehber bölümleri" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">{stages.map((stage, index) => <a key={stage.id} href={`#guide-${stage.id}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-sm text-panel-text hover:bg-panel-surface-soft"><span className="font-bold text-panel-warm">{index + 1}.</span>{stage.title}</a>)}</nav>
        <section className="rounded-2xl bg-panel-blue p-5 text-white" aria-label="Çalışma döngüsü"><h2 className="flex items-center gap-2 text-base font-bold"><Repeat2 size={20} aria-hidden="true" />Her çalışmada devam eden döngü</h2><p className="mt-3 text-sm leading-7">Görev verilir → test çözülür → sonuç girilir → yanlış soru fotoğraflanır → dijital hata defteri ve gelişim analizi oluşur.</p><p className="mt-2 text-sm leading-6">Yanlışları tekrar çalışın, yeni görevi planlayın ve aynı döngüyle ilerlemeyi sürdürün.</p></section>
        <div className="grid gap-4 md:grid-cols-2">{stages.map((stage, index) => <section key={stage.id} id={`guide-${stage.id}`} className="panel-card flex scroll-mt-24 flex-col p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue"><stage.icon size={21} aria-hidden="true" /></span><div><h2 className="text-lg font-bold leading-7 text-panel-text">{index + 1}. {stage.title}</h2>{stage.optional ? <span className="text-xs text-panel-text-muted">İsteğe bağlı</span> : stage.done ? <span className="text-xs font-semibold text-panel-blue">Bilgi mevcut</span> : null}</div></div>
          <p className="mt-4 text-sm leading-7 text-panel-text">{stage.body}</p><p className="mb-4 mt-3 rounded-xl bg-panel-surface-soft p-3 text-sm leading-6 text-panel-text-muted">{stage.tip}</p>
          <div className="mt-auto flex flex-col gap-2"><Link to={stage.to} className={LINK_CLASS}>{!student && stage.id !== 'profile' ? 'Önce çocuk profilini oluştur' : stage.cta}<ArrowRight size={15} className="shrink-0" aria-hidden="true" /></Link>{stage.secondary && student ? <Link to={stage.secondary.to} className={`${LINK_CLASS} border-transparent`}>{stage.secondary.label}</Link> : null}</div>
        </section>)}</div>
        <section className="panel-card p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-panel-text"><LineChart size={21} aria-hidden="true" />Günlük kullanım alışkanlığınız</h2><p className="mt-3 text-sm leading-7 text-panel-text-muted">Bugün ekranında görevleri gözden geçirin. Çalışma sonrası sonuçları kaydedin, yanlışları çocuğunuzla değerlendirin. Haftalık Plan’da sonraki çalışmaları düzenleyin; Gelişim Analizi’nde hangi alanlarda desteğe ihtiyaç olduğunu inceleyin.</p></section>
      </>}
    </div>
  )
}
