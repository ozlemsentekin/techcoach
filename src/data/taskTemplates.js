/** AddTaskDrawer'ı ön dolduran hazır görev şablonları. */
export const TASK_TEMPLATES = [
  {
    label: '20 soruluk Matematik testi',
    task: { title: 'Matematik Testi', subject: 'Matematik', taskType: 'test-cozme', durationMinutes: 45, targetQuestionCount: 20 },
  },
  {
    label: '20 soruluk Fen testi',
    task: { title: 'Fen Bilgisi Testi', subject: 'Fen Bilgisi', taskType: 'test-cozme', durationMinutes: 45, targetQuestionCount: 20 },
  },
  {
    label: '30 dk paragraf',
    task: { title: 'Paragraf Çalışması', subject: 'Türkçe', taskType: 'konu-tekrari', durationMinutes: 30 },
  },
  {
    label: '45 dk ödev',
    task: { title: 'Okul Ödevi', taskType: 'odev', durationMinutes: 45 },
  },
  {
    label: '30 dk yanlış tekrar',
    task: { title: 'Yanlış Soru Tekrarı', taskType: 'yanlis-tekrari', durationMinutes: 30 },
  },
  {
    label: '30 dk mola',
    task: { title: 'Mola', taskType: 'mola', durationMinutes: 30 },
  },
  {
    label: '2 saat serbest zaman',
    task: { title: 'Serbest Zaman', taskType: 'serbest-zaman', durationMinutes: 120 },
  },
]
