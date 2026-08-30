import { authRequest } from './authClient'

// Kitaplık (özel kaynak rafı). Veli / öğretmen / öğrenci ortak kullanır; sunucu aktörün
// rolüne ve yönettiği öğrencilere göre görünürlüğü ve atama yetkisini belirler.

export async function getBookshelfBooks({ studentId } = {}) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  const data = await authRequest(`/api/panel/bookshelf/resource-books${query}`, { method: 'GET' })
  return data.resourceBooks
}

export async function getBookshelfBook(resourceBookId) {
  return authRequest(`/api/panel/bookshelf/resource-books/${resourceBookId}`, { method: 'GET' })
}

export async function createBookshelfBook(payload) {
  const data = await authRequest('/api/panel/bookshelf/resource-books', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.resourceBook
}

export async function updateBookshelfBook(resourceBookId, payload) {
  const data = await authRequest(`/api/panel/bookshelf/resource-books/${resourceBookId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.resourceBook
}

export async function deleteBookshelfBook(resourceBookId) {
  return authRequest(`/api/panel/bookshelf/resource-books/${resourceBookId}`, { method: 'DELETE' })
}

export async function setBookshelfBookStudents(resourceBookId, studentIds) {
  const data = await authRequest(`/api/panel/bookshelf/resource-books/${resourceBookId}/students`, {
    method: 'PUT',
    body: JSON.stringify({ studentIds }),
  })
  return data.resourceBook
}

export async function createBookshelfPublisher(name) {
  const data = await authRequest('/api/panel/bookshelf/publishers', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return data.publisher
}
