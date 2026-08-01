/**
 * "Görevlerim" bölümü için görevin durumunu ekranda gösterilecek etikete, rengine
 * ve filtre grubuna çevirir. Backend'deki durum kelime hazinesi (bekliyor,
 * devam-ediyor, ...) sabit kalır; burada sadece görsel/filtre eşlemesi yapılır.
 *
 * tone 'theme' → öğrencinin aktif tema rengini kullanır (bkz. index.css
 * --color-student-theme-*); diğer ton'lar (sage/yellow/accent/slate/red) anlamı
 * evrensel olan sabit renklerdir ve temaya göre değişmez.
 *
 * Not: Rozet yalnızca task.status'e göre belirlenir; saate dayalı "gecikti"
 * mantığı kullanılmaz — gün bazlı gecikme TaskListCard içinde ayrıca hesaplanıp
 * bu rozetin üzerine yazılır (bkz. utils/time.js daysLate).
 */
export function getAssignmentStatus(task) {
  if (task.status === 'tamamlandi') {
    return { filterKey: 'done', label: 'Tamamlandı', tone: 'sage', icon: 'CheckCircle2' }
  }
  if (task.status === 'kismen-tamamlandi') {
    return { filterKey: 'done', label: 'Kontrol Bekleniyor', tone: 'yellow', icon: 'Eye' }
  }
  if (task.status === 'yeniden-planlandi') {
    return { filterKey: null, label: 'Yeniden planlandı', tone: 'slate', icon: 'RotateCcw' }
  }
  if (task.status === 'yardim-bekliyor') {
    return { filterKey: 'pending', label: 'Yardım isteniyor', tone: 'accent', icon: 'HelpCircle' }
  }
  if (task.status === 'devam-ediyor') {
    return { filterKey: 'pending', label: 'Devam Ediyor', tone: 'theme', icon: 'Timer' }
  }
  return { filterKey: 'pending', label: 'Yapılacak', tone: 'theme', icon: 'Circle' }
}
