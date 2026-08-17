import { useContext } from 'react'
import ParentStudentsGateContext from './parentStudentsGateContextObject'

// PanelLayout gibi rol-agnostik bileşenler tarafından da güvenle çağrılabilsin diye
// (öğrenci/öğretmen panelinde sağlayıcı yok), useAuth'tan farklı olarak sağlayıcı
// bulunamadığında fırlatmak yerine "çocuk var" varsayılan değerini döner.
const DEFAULT_GATE = { studentsLoading: false, hasStudents: true, markHasStudents: () => {} }

export function useParentStudentsGate() {
  const context = useContext(ParentStudentsGateContext)
  return context || DEFAULT_GATE
}
