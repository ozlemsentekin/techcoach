import { useState } from 'react'
import RolePreview from './RolePreview'
import { GraduationCap, HeartHandshake, BookOpen, ArrowRight } from 'lucide-react'

const cycleSteps = [
  ['Kaynağını ekle', 'Kullandığın kitapları oluştur.'],
  ['Planla', 'Görevlerini ve çalışma zamanını belirle.'],
  ['Çalış', 'Kendi kitabından testini çöz.'],
  ['Kaydet & Öğren', 'Sonucunu ve yanlışlarını sisteme aktar.'],
  ['Gelişimini izle', 'İlerlemeni aynı veriler üzerinden takip et.'],
]

const roles = [
  {
    id: 'student', name: 'Öğrenci', action: 'Planını uygula, gelişimini gör', icon: <GraduationCap size={24} aria-hidden="true" />,
  },
  {
    id: 'parent', name: 'Veli', action: 'Profilden gelişime, süreci yönet', icon: <HeartHandshake size={24} aria-hidden="true" />,
  },
  {
    id: 'teacher', name: 'Öğretmen', action: 'Planla, takip et, yön ver', icon: <BookOpen size={24} aria-hidden="true" />,
  },
]

export default function RolePanels() {
  const [active, setActive] = useState(0)
  const role = roles[active]
  function onTabKeyDown(event, index) {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % roles.length
    if (event.key === 'ArrowLeft') next = (index + roles.length - 1) % roles.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = roles.length - 1
    if (next === undefined) return
    event.preventDefault()
    setActive(next)
    document.getElementById(`role-tab-${roles[next].id}`)?.focus()
  }
  return (
    <section className="section role-section" id="paneller" aria-labelledby="roles-title">
      <div className="container">
        <h2 className="section-title" id="roles-title">TechCoach’ta sizi neler bekliyor?</h2>
        <p className="section-subtitle role-intro">Rolünüzü seçin, neler yapabileceğinizi keşfedin.</p>
        <div className="role-tabs" role="tablist" aria-label="Panelleri role göre keşfedin">
          {roles.map(({ id, name, icon }, index) => (
            <button key={id} type="button" role="tab" id={`role-tab-${id}`} aria-selected={active === index} aria-controls={`role-panel-${id}`} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={(event) => onTabKeyDown(event, index)}>
              {icon}<strong>{name}</strong>
            </button>
          ))}
        </div>
        <div className="role-detail" role="tabpanel" id={`role-panel-${role.id}`} aria-labelledby={`role-tab-${role.id}`} tabIndex={0} key={role.id}>
          <RolePreview key={role.id} role={role.id} name={role.name} />
        </div>
        <div className="role-cycle">
          <h3>Bir çalışma, herkes için anlamlı bilgiye dönüşür.</h3>
          <ol className="role-cycle-flow">
            {cycleSteps.map(([title, description], index) => (
              <li key={title}>
                <div className="role-cycle-card"><span>{index + 1}</span><strong>{title}</strong><p>{description}</p></div>
                {index < cycleSteps.length - 1 && <ArrowRight className="role-cycle-arrow" size={20} aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <p className="role-cycle-tagline">Daha bilinçli çalışma, daha görünür gelişim.</p>
        </div>
      </div>
    </section>
  )
}
