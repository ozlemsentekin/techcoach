// Kütüphane özelliği sadece ortaokul kademesini (5-8. sınıf) kapsıyor — bkz. api/src/catalog.js LIBRARY_GRADES.
export const LIBRARY_GRADES = ['5', '6', '7', '8']

export function libraryApiBase(role) {
  return role === 'teacher' ? '/api/panel-teacher' : '/api/parent'
}
