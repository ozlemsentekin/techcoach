import { authRequest } from './authClient'

/**
 * Öğrencinin okulu + sınıfı için tanımlı okul kaynakları, derse göre gruplu.
 * @returns {Promise<Array<{ subjectId: string, subjectName: string, resources: Array<{ id: string, name: string, imageUrl: string|null }> }>>}
 */
export async function getPanelSchoolResources() {
  const data = await authRequest('/api/panel/school-resources', { method: 'GET' })
  return data.groups || []
}
