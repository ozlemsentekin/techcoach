// Only the first real step is enabled. Add route + target definitions as the
// remaining steps are implemented; never mark their business actions complete.
export const PARENT_TOUR_TOTAL = 8
export const PARENT_TOUR_STEPS = [
  {
    id: 'create-child',
    route: '/parent/students',
    target: '[data-tour="create-child"]',
    title: 'Yolculuk burada başlıyor',
    description: 'Önce çocuğunuzun profilini oluşturun. Ardından okulunu ve kullandığı kaynakları ekleyerek çalışma alanını hazırlayacağız.',
    activateTarget: true,
  },
]
