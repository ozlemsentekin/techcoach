/**
 * Görev türü meta verisi: etiket, ikon adı (lucide-react) ve renk token'ı.
 * Brief bölüm 5'teki tüm görev türlerini + Pazartesi demo planında geçen ek türleri kapsar.
 */
export const TASK_TYPES = {
  'gunluk-rutin': { label: 'Günlük Rutin', icon: 'Sunrise', color: 'blue' },
  'ders-calisma': { label: 'Ders Çalışma', icon: 'BookOpen', color: 'blue' },
  'test-cozme': { label: 'Test Çözme', icon: 'ListChecks', color: 'blue' },
  'konu-tekrari': { label: 'Konu Tekrarı', icon: 'RotateCcw', color: 'blue' },
  odev: { label: 'Ödev', icon: 'NotebookPen', color: 'blue' },
  'odev-kontrolu': { label: 'Ödev Kontrolü', icon: 'CheckSquare', color: 'blue' },
  'kisa-akademik': { label: 'Kısa Akademik Çalışma', icon: 'PenLine', color: 'blue' },
  'deneme-sinavi': { label: 'Deneme Sınavı', icon: 'FileCheck2', color: 'blue' },
  'yanlis-tekrari': { label: 'Yanlış Soru Tekrarı', icon: 'RefreshCcw', color: 'blue' },
  planlama: { label: 'Planlama', icon: 'CalendarClock', color: 'lilac' },
  mola: { label: 'Mola', icon: 'Coffee', color: 'sage' },
  dinlenme: { label: 'Dinlenme', icon: 'Coffee', color: 'sage' },
  yemek: { label: 'Yemek', icon: 'Utensils', color: 'sage' },
  'yemek-dinlenme': { label: 'Yemek ve Dinlenme', icon: 'Utensils', color: 'sage' },
  'serbest-zaman': { label: 'Serbest Zaman', icon: 'Sun', color: 'accent' },
  'sosyal-aktivite': { label: 'Sosyal Aktivite', icon: 'Users', color: 'accent' },
  spor: { label: 'Spor', icon: 'Dumbbell', color: 'accent' },
  'sanat-hobi': { label: 'Sanat ve Hobi', icon: 'Music', color: 'lilac' },
  'uyku-hazirligi': { label: 'Uyku Hazırlığı', icon: 'Moon', color: 'sage' },
  'gunluk-degerlendirme': { label: 'Günlük Değerlendirme', icon: 'Star', color: 'accent' },
}

/** Bu türlerde "Başlat" odak ekranını (zamanlayıcı + soru sayacı / alt hedefler) açar. */
export const FOCUS_TASK_TYPES = new Set([
  'ders-calisma',
  'test-cozme',
  'konu-tekrari',
  'odev',
  'odev-kontrolu',
  'kisa-akademik',
  'deneme-sinavi',
  'yanlis-tekrari',
  'sanat-hobi',
  'planlama',
])

export const STATUS_LABELS = {
  bekliyor: 'Bekliyor',
  'devam-ediyor': 'Devam ediyor',
  tamamlandi: 'Tamamlandı',
  'kismen-tamamlandi': 'Kısmen tamamlandı',
  'yeniden-planlandi': 'Yeniden planlandı',
  'yardim-bekliyor': 'Yardım bekliyor',
}

export const RESCHEDULE_REASONS = [
  'Zaman yetmedi',
  'Çok yoruldum',
  'Konuyu anlamadım',
  'Başka ödev çıktı',
  'Kendimi iyi hissetmedim',
  'Plan değişti',
  'Diğer',
]

export const ENERGY_LEVELS = [
  { id: 'cok-yorgun', label: 'Çok yorgunum', icon: '😴' },
  { id: 'biraz-yorgun', label: 'Biraz yorgunum', icon: '😌' },
  { id: 'normal', label: 'Normalim', icon: '🙂' },
  { id: 'iyi', label: 'İyiyim', icon: '😊' },
  { id: 'enerjik', label: 'Çok enerjik hissediyorum', icon: '✨' },
]

export const ENERGY_MESSAGES = {
  'cok-yorgun': 'Bugün daha yumuşak başlayabiliriz. Önce 10 dakikalık kolay bir görev seçelim.',
  'biraz-yorgun': 'Planını koruyabiliriz ama molalarını atlamayalım.',
  normal: 'Hazırsan bugünün ilk adımıyla başlayalım.',
  iyi: 'Enerjin güzel görünüyor. Bu gücü dengeli kullanalım.',
  enerjik: 'Harika hissediyorsun. Yine de molalarını korumayı unutma.',
}

export const DIFFICULTY_OPTIONS = ['Çok kolaydı', 'Kolaydı', 'Dengeliydi', 'Zordu', 'Çok zorlandım']

export const EMOTION_OPTIONS = [
  'Odaklandım',
  'Biraz dağıldım',
  'Yoruldum',
  'Kaygılandım',
  'İyi hissettim',
  'Yardıma ihtiyacım var',
]
