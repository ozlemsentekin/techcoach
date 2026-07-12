import { todayISODate } from '../utils/time'

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} [subject]
 * @property {string} [topic]
 * @property {string} taskType
 * @property {string} date
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} durationMinutes
 * @property {number} [targetQuestionCount]
 * @property {number} [completedQuestionCount]
 * @property {string} status
 * @property {string} [difficulty]
 * @property {string} [notes]
 * @property {string} createdBy
 * @property {string} priority
 * @property {string|null} [rescheduledFrom]
 * @property {string|null} [rescheduledTo]
 * @property {string|null} [rescheduleReason]
 * @property {string|null} [completedAt]
 * @property {string[]} [subGoals]
 * @property {number[]} [completedSubGoals]
 * @property {string} [completionMessage]
 * @property {string} [focusMessage]
 * @property {string} [startLabel]
 * @property {number} [correctCount]
 * @property {number} [wrongCount]
 * @property {number} [blankCount]
 * @property {string} [emotion]
 * @property {Object} [reflectionAnswers]
 */

/** Aylin'in Pazartesi planı — brief bölüm 23, saatler/başlıklar/mesajlar birebir. */
export function buildMondayDemoTasks() {
  const date = todayISODate()

  return [
    {
      id: 'task_hazirlik',
      title: 'Güne Hazırlık',
      description: 'Uyanma, yüzünü yıkama, kahvaltı yapma ve piyano dersi için hazırlanma.',
      taskType: 'gunluk-rutin',
      date,
      startTime: '08:30',
      endTime: '09:00',
      durationMinutes: 30,
      status: 'tamamlandi',
      createdBy: 'sistem',
      priority: 'orta',
      completedAt: `${date}T08:30:00`,
    },
    {
      id: 'task_piyano',
      title: 'Piyano Dersi / Piyano Çalışması',
      description: 'Piyano öğretmeninin verdiği çalışmaların yapılması ve zorlanılan bölümlerin tekrar edilmesi.',
      taskType: 'sanat-hobi',
      date,
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      status: 'tamamlandi',
      createdBy: 'sistem',
      priority: 'orta',
      subGoals: [
        'Isınma çalışmasını yap',
        'Verilen parçayı tekrar et',
        'Zorlanılan bölümü en az iki kez çalış',
        'Bir sonraki ders için öğretmenin verdiği notları kontrol et',
      ],
      completedSubGoals: [0, 1, 2, 3],
      completionMessage: 'Piyano çalışmanı tamamladın. Şimdi zihnini kısa bir molayla dinlendirebilirsin.',
      completedAt: `${date}T10:00:00`,
    },
    {
      id: 'task_kisa_mola_1',
      title: 'Kısa Mola',
      description: 'Su içme, biraz hareket etme ve çalışma alanını havalandırma zamanı.',
      taskType: 'mola',
      date,
      startTime: '10:00',
      endTime: '10:05',
      durationMinutes: 5,
      status: 'tamamlandi',
      createdBy: 'sistem',
      priority: 'dusuk',
      completionMessage: 'Kısa molalar dikkatini yeniden toplamana yardımcı olur.',
      completedAt: `${date}T10:05:00`,
    },
    {
      id: 'task_odev_1',
      title: 'Okul Ödevleri – Birinci Çalışma Bölümü',
      description: 'Öncelikli ve teslim tarihi yakın olan okul ödevlerine başlanması.',
      taskType: 'odev',
      date,
      startTime: '10:05',
      endTime: '11:00',
      durationMinutes: 55,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'yuksek',
      subGoals: [
        'Öncelikli ödevi seç',
        'Ödev yönergesini oku',
        'Yapılabilen bölümleri tamamla',
        'Anlaşılmayan soruları işaretle',
        'Bitmeyen kısmı sonraki çalışma bölümüne ayır',
      ],
    },
    {
      id: 'task_dinlenme_kisisel',
      title: 'Dinlenme ve Kişisel Zaman',
      description: 'Atıştırmalık yeme, dinlenme ve ders dışı kısa bir mola verme zamanı.',
      taskType: 'dinlenme',
      date,
      startTime: '11:00',
      endTime: '11:30',
      durationMinutes: 30,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'dusuk',
    },
    {
      id: 'task_odev_2',
      title: 'Okul Ödevleri – İkinci Çalışma Bölümü',
      description: 'İlk çalışma bölümünde tamamlanmayan ödevlere devam edilmesi ve verilen soruların çözülmesi.',
      taskType: 'odev',
      date,
      startTime: '11:30',
      endTime: '12:15',
      durationMinutes: 45,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'yuksek',
      subGoals: [
        'Yarım kalan ödeve devam et',
        'Verilen soruları çöz',
        'Takıldığın soruları işaretle',
        'Öğretmene veya koça sorulacak soruları not et',
      ],
      completionMessage: 'Bugün yapabildiğin bölümü tamamladın. Kalan kısmı uygun bir güne birlikte yerleştirebiliriz.',
    },
    {
      id: 'task_odev_kontrol',
      title: 'Ödev Kontrolü ve Çözümlerini İnceleme',
      description: 'Yapılan ödevlerin kontrol edilmesi, yanlış veya boş bırakılan soruların çözümlerinin incelenmesi.',
      taskType: 'odev-kontrolu',
      date,
      startTime: '12:15',
      endTime: '13:00',
      durationMinutes: 45,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'orta',
      subGoals: [
        'Yapılan ödevleri kontrol et',
        'Yanlış veya boş soruları belirle',
        'Çözümünü anlamadığın soruları işaretle',
        'Yanlış soruları "Yanlışlarım" bölümüne ekle',
      ],
      focusMessage: 'Kontrol ettiğin her soru, neyi tekrar etmen gerektiğini daha iyi görmeni sağlar.',
    },
    {
      id: 'task_eksik_sorular',
      title: 'Eksik Soruları Tamamlama',
      description: 'Sabah çalışmalarında yarım kalan veya çözümü incelenmesi gereken soruların tamamlanması.',
      taskType: 'kisa-akademik',
      date,
      startTime: '13:00',
      endTime: '13:30',
      durationMinutes: 30,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'orta',
    },
    {
      id: 'task_ajanda_planlama',
      title: 'Ödevleri Ajandaya Aktarma ve Planlama',
      description: 'Okuldan verilen tüm ödevlerin ajandaya kaydedilmesi ve büyük ödevlerin uygun günlere bölünmesi.',
      taskType: 'planlama',
      date,
      startTime: '13:30',
      endTime: '14:00',
      durationMinutes: 30,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'orta',
      subGoals: [
        'Verilen tüm ödevleri ajandaya ekle',
        'Son teslim tarihlerini yaz',
        'Tahmini çalışma sürelerini belirle',
        'Büyük ödevleri küçük parçalara böl',
        'Hangi ödevin hangi gün yapılacağını planla',
        'Tamamlanmayan sabah görevlerini uygun günlere taşı',
      ],
      completionMessage: 'Ödevlerini planladın. Artık hepsini aklında tutmak zorunda değilsin; TechCoach senin için takip edecek.',
    },
    {
      id: 'task_serbest_zaman',
      title: 'Serbest Zaman ve Öğle Yemeği',
      description: 'Bu zaman dilimi ders dışı, serbest zaman olarak korunmalıdır. Öğle yemeği de bu zaman dilimine dâhildir.',
      taskType: 'serbest-zaman',
      date,
      startTime: '14:00',
      endTime: '17:00',
      durationMinutes: 180,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'dusuk',
      focusMessage: 'Bu zaman sana ait. Dinlenmek ve keyif aldığın şeyleri yapmak da planının önemli bir parçasıdır.',
    },
    {
      id: 'task_matematik_testi',
      title: 'Matematik Testi',
      description: 'Günün planlanan matematik testinin çözülmesi.',
      subject: 'Matematik',
      taskType: 'test-cozme',
      date,
      startTime: '17:00',
      endTime: '17:45',
      durationMinutes: 45,
      targetQuestionCount: 20,
      completedQuestionCount: 0,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'yuksek',
      subGoals: [
        'Testi süre tutarak çöz',
        'Takıldığın soruları işaretle',
        'Boş bıraktığın soruları kaydet',
        'Çalışma sonunda doğru, yanlış ve boş sayılarını gir',
      ],
      startLabel: 'Matematik Testine Başla',
      focusMessage: 'Bu 45 dakika boyunca yalnızca önündeki sorulara odaklan. Testin tamamı bitmezse kalan soruları yeniden planlayabiliriz.',
    },
    {
      id: 'task_dinlenme_2',
      title: 'Dinlenme Zamanı',
      description: 'Matematik testinden sonra yarım saatlik dinlenme zamanı.',
      taskType: 'mola',
      date,
      startTime: '17:45',
      endTime: '18:15',
      durationMinutes: 30,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'dusuk',
      completionMessage: 'Matematik çalışmanı tamamladın. Şimdi yarım saat boyunca dinlenebilirsin.',
    },
    {
      id: 'task_fen_testi',
      title: 'Fen Bilgisi Testi',
      description: 'Günün planlanan Fen Bilgisi testinin çözülmesi.',
      subject: 'Fen Bilgisi',
      taskType: 'test-cozme',
      date,
      startTime: '18:15',
      endTime: '19:00',
      durationMinutes: 45,
      targetQuestionCount: 20,
      completedQuestionCount: 0,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'yuksek',
      subGoals: [
        'Testi süre tutarak çöz',
        'Bilmediğin konuları işaretle',
        'Yanlış veya boş soruları kaydet',
        'Çalışma sonunda sonuçlarını gir',
      ],
      startLabel: 'Fen Bilgisi Testine Başla',
      focusMessage: 'Şimdi sadece Fen Bilgisi testine odaklan. Zorlandığın sorular, hangi konulara tekrar bakacağını gösterecek.',
    },
    {
      id: 'task_aksam_yemegi',
      title: 'Akşam Yemeği ve Dinlenme',
      description: 'Akşam yemeği, aileyle zaman geçirme ve dinlenme bölümü.',
      taskType: 'yemek-dinlenme',
      date,
      startTime: '19:00',
      endTime: '20:00',
      durationMinutes: 60,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'dusuk',
    },
    {
      id: 'task_gun_degerlendirme',
      title: 'Günün Kısa Değerlendirmesi',
      description: 'Günün nasıl geçtiğinin baskı oluşturmadan değerlendirilmesi.',
      taskType: 'gunluk-degerlendirme',
      date,
      startTime: '20:00',
      endTime: '20:20',
      durationMinutes: 20,
      status: 'bekliyor',
      createdBy: 'sistem',
      priority: 'orta',
      reflectionQuestions: [
        'Bugün hangi görevlerini tamamladın?',
        'Hangi görevlerin yarım kaldı?',
        'En çok hangi derste zorlandın?',
        'Bugün kendini nasıl hissettin?',
        'Yarına taşınması gereken bir görevin var mı?',
        'Bugün kendinle ilgili takdir ettiğin bir şey neydi?',
      ],
    },
  ]
}

export const MONDAY_DAILY_SUMMARY = [
  '1 piyano çalışması',
  '2 okul ödevi çalışma bölümü',
  '1 ödev kontrolü',
  '1 ajanda ve haftalık planlama bölümü',
  '2 ders testi',
  'Toplam 40 test sorusu',
  '3 saat serbest zaman',
  'Düzenli kısa molalar',
]

export const MONDAY_MAIN_MESSAGE =
  'Bugün her şeyi bir anda tamamlamak zorunda değilsin. Sadece sıradaki adıma odaklanman yeterli.'
