import { useContext } from 'react'
import TeacherClassesContext from './teacherClassesContextObject'

// PanelLayout / TeacherSidebar gibi rol-agnostik ya da öğretmen paneli dışında da render
// edilebilen bileşenler güvenle çağırabilsin diye, sağlayıcı yoksa "menü yok" varsayılanı döner.
const DEFAULT = { classesLoading: false, grades: [], hasUnspecified: false, studentCount: 0 }

export function useTeacherClasses() {
  return useContext(TeacherClassesContext) || DEFAULT
}
