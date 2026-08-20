import { useRef, useState } from 'react'

export const TOC_MAX_DIMENSION = 1600
export const TOC_JPEG_QUALITY = 0.82
export const TOC_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const TOC_MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const TOC_MAX_IMAGES = 8

export function useLocalId() {
  const counter = useRef(0)
  return () => {
    counter.current += 1
    return `local-${counter.current}`
  }
}

export function emptyTest(nextId) {
  return { id: nextId(), topicName: '', name: '', pageCount: '', questionCount: '' }
}

export function emptyTopic(nextId) {
  return { id: nextId(), name: '', tests: [emptyTest(nextId)] }
}

// AddLibraryResourceWizard (yeni kaynak) ile AddLibraryResourceContentModal (mevcut kaynağa
// içerik ekleme) arasında paylaşılan içerik/test listesi durum yönetimi.
export function useTopicsState(nextId) {
  const [topics, setTopics] = useState(() => [emptyTopic(nextId)])

  const updateTopic = (topicId, changes) => {
    setTopics((current) => current.map((topic) => (topic.id === topicId ? { ...topic, ...changes } : topic)))
  }

  const updateTest = (topicId, testId, changes) => {
    setTopics((current) =>
      current.map((topic) =>
        topic.id !== topicId
          ? topic
          : { ...topic, tests: topic.tests.map((test) => (test.id === testId ? { ...test, ...changes } : test)) },
      ),
    )
  }

  const addTopic = () => setTopics((current) => [...current, emptyTopic(nextId)])
  const removeTopic = (topicId) => setTopics((current) => current.filter((topic) => topic.id !== topicId))
  const addTest = (topicId) =>
    setTopics((current) =>
      current.map((topic) => (topic.id === topicId ? { ...topic, tests: [...topic.tests, emptyTest(nextId)] } : topic)),
    )
  const removeTest = (topicId, testId) =>
    setTopics((current) =>
      current.map((topic) =>
        topic.id !== topicId ? topic : { ...topic, tests: topic.tests.filter((test) => test.id !== testId) },
      ),
    )

  return { topics, setTopics, updateTopic, updateTest, addTopic, removeTopic, addTest, removeTest }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Görsel okunamadı.'))
    image.src = src
  })
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

// Fihrist fotoğraflarını kırpmadan (kare değil) makul bir boyuta küçültür; metin okunaklı kalır,
// yükleme boyutu ise birden fazla sayfa gönderildiğinde makul kalır.
export async function resizeTocImage(file) {
  if (!TOC_ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('JPG, PNG veya WEBP görsel seçin.')
  }
  if (file.size > TOC_MAX_UPLOAD_BYTES) {
    throw new Error('Görsel en fazla 8 MB olabilir.')
  }

  const sourceUrl = await readFileAsDataUrl(file)
  const image = await loadImageElement(sourceUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const scale = Math.min(1, TOC_MAX_DIMENSION / Math.max(width, height))
  const outWidth = Math.round(width * scale)
  const outHeight = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, outWidth, outHeight)
  context.drawImage(image, 0, 0, outWidth, outHeight)

  return canvas.toDataURL('image/jpeg', TOC_JPEG_QUALITY)
}

// Sunucuya göndermeden önce içerik/test listesini doğrular — AddLibraryResourceWizard ile
// AddLibraryResourceContentModal arasında paylaşılır.
export function validateTopicsForSubmit(topics) {
  for (const topic of topics) {
    if (topic.name.trim().length < 2) {
      return 'Her içeriğin adı en az 2 karakter olmalı.'
    }
    if (!topic.tests.length) {
      return `"${topic.name}" içeriğine en az bir test eklenmeli.`
    }
    for (const test of topic.tests) {
      if (test.topicName.trim().length < 2 || test.name.trim().length < 2) {
        return 'Test konusu ve adı en az 2 karakter olmalı.'
      }
      const pageCount = Number(test.pageCount)
      const questionCount = Number(test.questionCount)
      if (!Number.isInteger(pageCount) || pageCount <= 0) {
        return 'Sayfa sayısı pozitif bir tam sayı olmalı.'
      }
      if (!Number.isInteger(questionCount) || questionCount <= 0) {
        return 'Soru sayısı pozitif bir tam sayı olmalı.'
      }
    }
  }
  return null
}

export function topicsToPayload(topics) {
  return topics.map((topic) => ({
    name: topic.name.trim(),
    tests: topic.tests.map((test) => ({
      topicName: test.topicName.trim(),
      name: test.name.trim(),
      pageCount: Number(test.pageCount),
      questionCount: Number(test.questionCount),
    })),
  }))
}

// Fihristte genelde sadece başlangıç sayfası yazar; bitiş sayfası açık değilse bir sonraki
// testin başlangıcından çıkarım yapılır (aynı kitap boyunca kümülatif sayfa akışı varsayımıyla).
export function applyExtractedTopics(rawTopics, nextId) {
  const flatTests = []
  rawTopics.forEach((topic, topicIndex) => {
    topic.tests.forEach((test, testIndex) => flatTests.push({ topicIndex, testIndex, test }))
  })
  flatTests.forEach((entry, i) => {
    if (entry.test.pageEnd == null && entry.test.pageStart != null) {
      const next = flatTests[i + 1]
      if (next && next.test.pageStart != null && next.test.pageStart > entry.test.pageStart) {
        entry.test.pageEnd = next.test.pageStart - 1
      }
    }
  })

  return rawTopics.map((topic) => ({
    id: nextId(),
    name: topic.name,
    tests: topic.tests.map((test) => {
      const hasRange =
        Number.isInteger(test.pageStart) && Number.isInteger(test.pageEnd) && test.pageEnd >= test.pageStart
      return {
        id: nextId(),
        topicName: test.topicName,
        name: test.name,
        pageCount: hasRange ? String(test.pageEnd - test.pageStart + 1) : '',
        questionCount: '',
      }
    }),
  }))
}
