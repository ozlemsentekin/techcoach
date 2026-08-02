/**
 * Sistem tarafından gösterilen motivasyon mesajı havuzu, kategoriye göre gruplanmış.
 * Kategoriler öğrencinin güncel durumundan (enerji, ilerleme, yardım isteği) türetilir,
 * bkz. src/services/motivationMessageService.js -> determineMessageCategory.
 */
export const MOTIVATION_MESSAGES = [
  {
    id: 'general-01',
    category: 'general',
    title: 'Küçük adımlar büyük hedeflere ulaştırır.',
    body: 'Bugün attığın her adım, yarınki başarını inşa eder.',
    isActive: true,
  },
  {
    id: 'low-energy-01',
    category: 'low_energy',
    title: 'Bugün daha yumuşak ilerleyebilirsin.',
    body: 'Küçük bir görevle başlamak da ilerlemenin bir parçasıdır.',
    isActive: true,
  },
  {
    id: 'low-energy-02',
    category: 'low_energy',
    title: 'Enerjin düşük olabilir, emeğin hâlâ değerli.',
    body: 'Önce kolay bir adım seç, sonra nasıl hissettiğine yeniden bak.',
    isActive: true,
  },
  {
    id: 'high-stress-01',
    category: 'high_stress',
    title: 'Her şeyi şu anda bitirmek zorunda değilsin.',
    body: 'Bir nefes al ve yalnızca sıradaki küçük adıma odaklan.',
    isActive: true,
  },
  {
    id: 'high-stress-02',
    category: 'high_stress',
    title: 'Zorlanman, yapamayacağın anlamına gelmez.',
    body: 'Planı küçültmek ve mola vermek de doğru bir seçimdir.',
    isActive: true,
  },
  {
    id: 'start-easy-01',
    category: 'start_easy',
    title: 'Bugün attığın her adım, seni hedefindeki liseye yaklaştırıyor.',
    body: 'Mükemmel olmak zorunda değilsin; sadece başlayıp devam etmen yeterli.',
    isActive: true,
  },
  {
    id: 'task-started-01',
    category: 'task_started',
    title: 'Başlamak en önemli adımdı.',
    body: 'Şimdi sadece önündeki kısa çalışma süresine odaklan.',
    isActive: true,
  },
  {
    id: 'partial-completion-01',
    category: 'partial_completion',
    title: 'Tamamladığın bölüm de değerlidir.',
    body: 'Kalan kısmı başka bir zamana planlamak başarısızlık değildir.',
    isActive: true,
  },
  {
    id: 'strong-progress-01',
    category: 'strong_progress',
    title: 'Bugün güzel bir ritim yakaladın.',
    body: 'Molalarını koruyarak aynı dengede devam edebilirsin.',
    isActive: true,
  },
  {
    id: 'completed-day-01',
    category: 'completed_day',
    title: 'Bugünün planını tamamladın.',
    body: 'Şimdi emeğini fark etme ve dinlenme zamanı.',
    isActive: true,
  },
]

export function getMessagesByCategory(category) {
  return MOTIVATION_MESSAGES.filter((message) => message.category === category && message.isActive)
}
