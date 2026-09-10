import { useState } from 'react'
import RolePreview from './RolePreview'
import { GraduationCap, HeartHandshake, BookOpen, ChartNoAxesCombined } from 'lucide-react'

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
        <p className="role-eyebrow">ÜÇ ROL, ORTAK GELİŞİM</p>
        <h2 className="section-title" id="roles-title">TechCoach’ta sizi neler bekliyor?</h2>
        <p className="section-subtitle role-intro">Rolünüzü seçin, ilk adımdan gelişim takibine kadar neler yapabileceğinizi keşfedin.</p>
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
        <div className="role-cycle"><div className="role-cycle-heading"><ChartNoAxesCombined size={24} aria-hidden="true" /><div><h3>Bir çalışma, herkes için anlamlı bilgi.</h3><p>Sonuçları öğrenci veya veli kaydeder; öğrenci, veli ve öğretmen gelişimi birlikte takip eder.</p></div></div><ol>{['Kaynak ekle', 'Görev planla', 'Kitaptan çalış', 'Sonucu ve yanlışları kaydet', 'Gelişimi birlikte takip et'].map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol></div>
      </div>
    </section>
  )
}
