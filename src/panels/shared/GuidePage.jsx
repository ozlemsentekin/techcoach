import { CalendarRange, Users, BookOpen, TrendingUp, MessageCircle, PencilLine } from 'lucide-react'
import GuideFlow from './GuideFlow'
import { useAuth } from '../../context/useAuth'

const GUIDES = {
  ogrenci: {
    role: 'Öğrenci',
    intro: 'Gününü planla, çalışmanı kaydet ve yanlışlarından öğren. TechCoach’ta kendi ilerlemeni takip etmek için bu adımları kullan.',
    routine: 'Başlamadan önce Bugün ekranını kontrol et. Çalışma bitince sonucunu kaydet. Haftanın sonunda hata defterine ve gelişimine bakarak tekrar edeceğin konuları belirle.',
    steps: [
      ['Gününü ve haftanı tanı', 'Bugün ekranında sıradaki görevlerini incele. Bu Hafta ekranından yaklaşan çalışmalarını gör ve çalışma zamanını planla.', 'Bir göreve başlamadan önce ders, kaynak ve hedef bilgilerini kontrol et.', '/student/today', 'Bugün ekranını aç'],
      ['Çalışmaya başla ve sonucunu kaydet', 'Bugün ekranından bir görevi aç. Çalışma ekranındaki süre ve soru takibini kullan; bitirdiğinde görevin türüne uygun sonuçlarını kaydet.', 'Sonuçlarını sen veya velin kaydedebilir. Velin kendi profilindeki “Öğrenciye geç” ile senin görevini tamamlayabilir; aynı sonucu tekrar girmeniz gerekmez. Cihaz kullanmıyorsan kağıt üzerinde çalışıp veri takibini veline bırakabilirsin.', '/student/weekly-plan', 'Haftalık planı aç'],
      ['Geçmiş çalışmalarını incele', 'Çalışma Geçmişim ekranından tamamladığın çalışmaları ve kaydettiğin sonuçları incele.', 'Eksik bir sonuç fark edersen ilgili çalışmanın ayrıntılarını kontrol et.', '/student/study-history', 'Çalışma geçmişini aç'],
      ['Yanlışlarını tekrar çalış', 'Yanlış soruların fotoğraflarını çalışma sonucuna ekleyerek tekrar için sakla. Hata Defterim ekranında bu sorulara geri dön.', 'Yalnızca doğru cevaba bakma; hangi adımda zorlandığını belirleyip soruyu yeniden çöz.', '/student/mistakes', 'Hata defterini aç'],
      ['Deneme sonuçlarını takip et', 'Deneme Sınavları ekranında Branş İzleme, Genel Deneme ve Etüt sonuçlarını sen veya velin kaydedebilir. Doğru, yanlış ve boş sayılarını, netlerini ve soru görsellerini buradan takip et.', 'Deneme sonuçlarını düzenli takip ederek tekrar gerektiren derslerini belirle.', '/student/mock-exams', 'Deneme sınavlarını aç'],
      ['Gelişimini değerlendir', 'Gelişimim ekranında soru sayılarını, doğruluk oranlarını ve güçlü ya da tekrar gerektiren konularını incele. Ders Başarım ekranından ders bazındaki durumuna bak; sonuçlarını velin kaydetse de kendi gelişimini burada takip edebilirsin.', 'Az veri olduğunda analizler sınırlı olabilir. Düzenli kaydedilen çalışmalar ilerlemeni anlamanı kolaylaştırır.', '/student/progress', 'Gelişimimi aç'],
      ['Öğretmenlerini gör ve destek iste', 'Öğretmenlerim ekranından bağlantılı öğretmenlerini incele. Sistemle ilgili bir sorun veya öneri için Taleplerim ekranında talep oluştur ve yanıtlarını takip et.', 'Sorunun hangi ekranda ve hangi işlem sırasında oluştuğunu açıklaman çözümü kolaylaştırır.', '/student/requests', 'Taleplerimi aç'],
    ],
  },
  ogretmen: {
    role: 'Öğretmen',
    intro: 'Öğrenci, veli, kaynak ve çalışma sonuçlarını bir arada takip edin. İlk hazırlıktan haftalık değerlendirmeye kadar çalışma akışınızı burada bulabilirsiniz.',
    routine: 'Güne Bildirimler menüsündeki öğrenci aksiyonlarını inceleyerek başlayın. Öğrencinin Takvim sekmesinde o gün verdiğiniz görevlerin durumunu kontrol edin. İncelediğiniz optik sonucu “Kontrol edildi” olarak işaretleyin. Ders öncesinde Hata Defteri’ndeki soru görsellerini açıp kendi hata nedeninizi ve önerinizi kaydedin, Gelişim Analizi’ni inceleyin; ders sonrası bir sonraki görevi planlayın. Deneme Sonuçları ve Sınıf Analizi ile haftalık değerlendirmeyi tamamlayın.',
    steps: [
      ['Öğrencilerinizi tanıyın', 'Öğrencilerim ekranındaki öğrenci listesini inceleyin. Bir öğrencinin detayını açarak çalışma ve gelişim bilgilerine ulaşın.', 'Önce doğru öğrenciyle çalıştığınızı ve öğrencinin sınıf bilgisini kontrol edin.', '/teacher/students', 'Öğrencilerimi aç'],
      ['Velilerle bağlantıyı kurun', 'Velilerim ekranından veli bağlantılarınızı inceleyin. Öğrenci ve veli ilişkilerini kontrol ederek çalışma takibini doğru kişiyle sürdürün.', 'Öğrenciye ait erişimler ve bağlantılar hangi bilgileri görebileceğinizi belirler.', '/teacher/parents', 'Velilerimi aç'],
      ['Kaynaklarınızı hazırlayın', 'Kitaplık ekranından kullandığınız kaynakları düzenleyin. Kütüphane yönetim yetkiniz varsa kaynak kataloğuna Kütüphane menüsünden ulaşın.', 'Görev verirken öğrencinin çalışacağı kitap, konu ve testi açıkça seçin.', 'resources', 'Kaynakları aç'],
      ['Dersleri ve ödevleri planlayın', 'Ders Planım ekranında ders programınızı düzenleyin. Öğrenci detayındaki görev ve ödev seçenekleriyle öğrencinin çalışmasını planlayın.', 'Görevin tarihini ve kapsamını belirleyin; öğrencinin mevcut yükünü de göz önünde bulundurun.', '/teacher/lesson-plan', 'Ders planımı aç'],
      ['Verdiğiniz görevleri takvimden günlük takip edin', 'Öğrencilerim → ilgili öğrenci → Takvim yolunu açın. Çalışma takviminde gün gün ilerleyerek verdiğiniz görevleri, planlanan çalışmaları ve tamamlanma durumlarını inceleyin. Bir görevi açıp kaynak, konu ve sonuç ayrıntılarına ulaşın.', 'Ders Planım kendi ders programınızı düzenlemek içindir; öğrencinin günlük görev takibini öğrenci detayındaki Takvim sekmesinden yapın. Bekleyen çalışmalara göre bir sonraki görevin kapsamını belirleyin.', '/teacher/students', 'Takvim için öğrenci seç'],
      ['Bildirimlerden öğrencilerin aksiyonlarını görün', 'Panelin üst kısmındaki zil simgesinden Bildirimler menüsünü açın. Öğrencilerinizin sisteme yansıyan aksiyonlarını buradan takip edin. Görevle ilişkili bir bildirime dokunarak ilgili görevin veya optik sonucunun ayrıntısını inceleyin.', 'Bildirimler listesi okunmamış kayıtları gösterir; açtığınız bildirim listeden çıkar. Sonradan aynı çalışmaya dönmek için ilgili öğrencinin Takvim sekmesini kullanın.', '/teacher/students', 'Öğrencilerimi aç'],
      ['Görev sonuçlarını inceleyip ders odağını belirleyin', 'Öğrencinin Takvim sekmesinden tamamlanan görevi açın. Görevin türüne göre doğru, yanlış ve boş sayılarını veya optik cevaplarını inceleyin. Yanlış ve boş bırakılan soruları sonraki dersin hazırlığında kullanın.', 'Sonuçları öğrenci veya veli kaydedebilir. Çocuk cihaz kullanmıyorsa veli kendi hesabından “Öğrenciye geç” ile görevi tamamlayabilir; siz aynı öğrenciye ait kayıtlı sonuçları takip edersiniz.', '/teacher/students', 'Sonuçlar için öğrenci seç'],
      ['Hata Defteri’nde öğrencinin soru görsellerini açın', 'Öğrencilerim → ilgili öğrenci → Hata Defteri yolunu izleyin. Öğrencinin kaydettiği yanlış soruların görsellerini açarak sorunun kendisini inceleyin. Varsa hata nedeni ve notlarıyla birlikte değerlendirin; tekrar çalışmasını bu sorular üzerinden hazırlayın.', 'Görseller, öğrenci veya veli tarafından eklendiğinde görünür. Yalnızca yanlış sayısına bakmak yerine sorudaki çözüm adımını öğrencinizle konuşun.', '/teacher/students', 'Hata defteri için öğrenci seç'],
      ['İncelediğiniz görevi “Kontrol edildi” olarak işaretleyin', 'Tamamlanan görevin optik sonucunu açıp cevapları ve varsa soru görsellerini inceleyin. Ardından “Kontrol edildi olarak işaretle” düğmesini kullanın. Kayıtta kontrol eden kişinin adı ve kontrol zamanı görünür; gerektiğinde “Geri al” ile işareti kaldırabilirsiniz.', 'Bu işaret, öğrencinin görevi tamamlamasından ayrı olarak öğretmen incelemesinin yapıldığını belirtir. Hangi sonuçlara baktığınızı takip etmenizi ve kontrol bekleyen çalışmaları ayırt etmenizi kolaylaştırır; tüm cevapların doğru olduğu anlamına gelmez.', '/teacher/students', 'Kontrol için öğrenci seç'],
      ['Hata nedenini öğretmen olarak analiz edin', 'Öğrencinin Hata Defteri’nde bir soru görselini açın. Kendi öğretmen analizinize hata nedenini seçin: Dikkat Hatası, Bilgi Eksikliği veya Soruyu Anlamadım. Gerekirse çözüm yaklaşımını ve tekrar önerinizi not olarak ekleyin. “Benim analiz etmediklerim” filtresiyle değerlendirmeniz eksik sorulara ulaşın.', 'Öğrenci, veli ve öğretmen analizleri ayrı kaydedilir; kendi değerlendirmeniz diğerlerinin notlarını değiştirmez. Görüşleri karşılaştırarak bilgi eksikliğinde konu tekrarı, dikkat hatasında kontrol alışkanlığı, soruyu anlamada ise okuma ve yorumlama çalışması planlayabilirsiniz. Hata nedeni seçildiğinde soru sizin için analiz edilmiş sayılır.', '/teacher/students', 'Hata analizi için öğrenci seç'],
      ['Deneme Sonuçları ile sınav performansını değerlendirin', 'Öğrencilerim → ilgili öğrenci → Deneme Sonuçları sekmesinde Branş İzleme, Genel Deneme ve Etüt kayıtlarını inceleyin. Derslerin doğru, yanlış, boş ve net bilgilerini, varsa soru görsellerini birlikte değerlendirin.', 'Günlük görevlerle deneme sonuçlarını birlikte ele alarak öğrencinin sınavda zorlandığı dersler için tekrar planlayın. Sınıf düzeyindeki denemelere Sınıf Analizi ekranından da ulaşabilirsiniz.', '/teacher/students', 'Denemeler için öğrenci seç'],
      ['Gelişim Analizi ile bireysel ilerlemeyi görün', 'Öğrencilerim → ilgili öğrenci → Gelişim Analizi sekmesini açın. Kaydedilen çalışmaları, doğruluk oranlarını ve kaynak ilerlemesini inceleyerek güçlü ve tekrar gerektiren alanları belirleyin.', 'Görevin tamamlanması ile konunun öğrenilmesi aynı şey değildir. Çalışma miktarını sonuçlarla birlikte okuyun; sonraki görevin konusunu ve kapsamını bu değerlendirmeye göre seçin.', '/teacher/students', 'Gelişim için öğrenci seç'],
      ['Sınıf Analizi ile genel durumu karşılaştırın', 'Sınıf Analizi ekranında sınıf düzeyini seçerek öğrencilerin sonuçlarını birlikte inceleyin. Ortak zorlanılan alanları sınıf çalışmasına, bireysel eksikleri öğrenciye özel görevlere dönüştürün.', 'Henüz öğrenci veya sonuç yoksa önce öğrenci bağlantılarını ve çalışma kayıtlarını tamamlayın. Analizler, kaydedilen sonuçlar üzerinden oluşur.', '/teacher/class-analysis', 'Sınıf analizini aç'],
      ['Talep oluşturun ve yanıtları takip edin', 'Sistemle ilgili sorunlarınızı ve önerilerinizi Taleplerim ekranından iletin. Gönderdiğiniz taleplerin durumunu ve yanıtlarını aynı yerden takip edin.', 'Kitap talebinde doğru kaynak bilgilerini; sorun bildiriminde ilgili ekranı ve işlem adımlarını paylaşın.', '/teacher/requests', 'Taleplerimi aç'],
    ],
  },
}

export default function GuidePage() {
  const { authUser } = useAuth()
  const guide = GUIDES[authUser?.role]
  if (!guide) return null

  const student = authUser.role === 'ogrenci'
  const phases = student ? [
    { title: 'Planla', description: 'Gününü ve hedefini belirle', icon: CalendarRange, steps: [0] },
    { title: 'Çalış', description: 'Başla, tamamla, kaydet', icon: PencilLine, steps: [1, 2] },
    { title: 'Değerlendir', description: 'Yanlışlarından öğren', icon: TrendingUp, steps: [3, 4, 5] },
    { title: 'İletişimde kal', description: 'Öğretmenler ve destek', icon: MessageCircle, steps: [6] },
  ] : [
    { title: 'Tanış', description: 'Öğrenci ve veli bağlantıları', icon: Users, steps: [0, 1] },
    { title: 'Hazırla', description: 'Kaynaklar ve ders programı', icon: BookOpen, steps: [2, 3] },
    { title: 'Takip et', description: 'Günlük görevler, bildirimler ve yanlışlar', icon: CalendarRange, steps: [4, 5, 6, 7, 8, 9] },
    { title: 'Değerlendir', description: 'Denemeler, gelişim ve destek', icon: TrendingUp, steps: [10, 11, 12, 13] },
  ]
  const labels = student ? ['Günüm', 'Çalışma', 'Geçmiş', 'Hata defteri', 'Denemeler', 'Gelişim', 'İletişim'] : ['Öğrenciler', 'Veliler', 'Kaynaklar', 'Ders planı', 'Günlük takvim', 'Bildirimler', 'Görev sonuçları', 'Hata Defteri', 'Kontrol edildi', 'Öğretmen hata analizi', 'Deneme Sonuçları', 'Gelişim Analizi', 'Sınıf Analizi', 'Talepler']
  const steps = guide.steps.map(([title, body, tip, path, cta], index) => ({
    id: String(index), shortTitle: labels[index], title, body, tip, cta,
    to: path === 'resources' ? (authUser?.canManageLibrary ? '/teacher/library' : '/teacher/bookshelf') : path,
  }))
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-panel-warm">{guide.role} rehberi</p>
        <h1 className="mt-2 text-2xl font-bold text-panel-text sm:text-3xl">Birlikte, adım adım.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-panel-text-muted">{guide.intro}</p>
      </header>
      <GuideFlow key={authUser.role} phases={phases} steps={steps} />
      <details className="rounded-xl border border-panel-border bg-panel-surface p-5">
        <summary className="cursor-pointer font-semibold text-panel-text">Günlük kullanım alışkanlığı</summary>
        <p className="mt-3 text-sm leading-7 text-panel-text-muted">{guide.routine}</p>
      </details>
    </div>
  )
}
