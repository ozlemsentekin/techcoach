import { useState } from 'react'
import { BookMarked, CalendarRange, LineChart, Sparkles, X } from 'lucide-react'
import Button from '../../ui/Button'

// Sıfırdan üye olan bir velinin ilk girişinde bir kez gösterilen tanıtım modalı.
// "Görüldü" bilgisi StudentsPage/ParentApp tarafında localStorage'da tutulur; bu
// bileşen yalnızca sunumdan sorumludur.
const SLIDES = [
  {
    icon: Sparkles,
    title: 'TechCoach’a hoş geldiniz',
    body: 'TechCoach, çocuğunuzun çalışma düzenini birlikte kurup takip etmeniz için bir koçluk paneli. Kurulum yalnızca birkaç dakika sürer.',
  },
  {
    icon: BookMarked,
    title: '1. Çocuğunuzun profilini oluşturun',
    body: 'Ad, sınıf ve okul bilgisini girin. Ardından çocuğunuza kitap ve kaynak atayın; hangi konularda çalışacağını siz belirleyin.',
  },
  {
    icon: CalendarRange,
    title: '2. Haftalık planı kurun',
    body: 'Gün gün ödev, test ve mola ekleyin. Özel ders alıyorsa öğretmenini tanımlayın; ders saatleri plana otomatik yansır.',
  },
  {
    icon: LineChart,
    title: '3. Gelişimi takip edin',
    body: '“Bugün” akışında günlük görevleri, hata defterinde yanlışları, gelişim analizinde ilerlemeyi görürsünüz. Hazırsanız başlayalım.',
  },
]

export default function ParentWelcomeModal({ parentName, onClose }) {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const Icon = slide.icon
  const isLast = index === SLIDES.length - 1
  const firstName = parentName?.trim().split(/\s+/)[0] || ''

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-panel-2 sm:h-auto sm:rounded-2xl">
        <div className="flex items-center justify-end px-4 pt-3">
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center gap-4 px-6 pb-2 pt-2 text-center sm:pt-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-panel-accent-soft text-panel-warm">
            <Icon size={30} aria-hidden="true" />
          </span>
          <h2 className="text-xl font-bold text-panel-text">
            {index === 0 && firstName ? `${slide.title}, ${firstName}` : slide.title}
          </h2>
          <p className="max-w-sm text-base leading-7 text-panel-text-muted">{slide.body}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 py-4">
          {SLIDES.map((item, dotIndex) => (
            <span
              key={item.title}
              className={`h-1.5 rounded-full transition-all ${
                dotIndex === index ? 'w-5 bg-panel-warm' : 'w-1.5 bg-panel-border-strong'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#edf0f1] px-4 py-3 sm:px-6 sm:py-4">
          {index > 0 ? (
            <Button type="button" variant="secondary" size="md" onClick={() => setIndex((current) => current - 1)}>
              Geri
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Geç
            </Button>
          )}

          {isLast ? (
            <Button type="button" size="md" onClick={onClose}>
              Kuruluma başla
            </Button>
          ) : (
            <Button type="button" size="md" onClick={() => setIndex((current) => current + 1)}>
              Devam
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
