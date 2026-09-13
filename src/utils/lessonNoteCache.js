// A viewer-local cache: never shared between accounts, bounded by image data size.
export function createLessonNoteCache({ maxCharacters = 14000000, ttlMs = 60000, now = Date.now } = {}) {
  const entries = new Map()
  let size = 0
  function remove(key) {
    const entry = entries.get(key)
    if (entry) { size -= entry.size; entries.delete(key) }
  }
  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return null
      if (entry.expires <= now()) { remove(key); return null }
      entries.delete(key); entries.set(key, entry)
      return entry.note
    },
    set(key, note) {
      remove(key)
      const characters = note.images.reduce((total, image) => total + image.length, 0)
      if (characters > maxCharacters) return
      for (const [id, entry] of entries) if (entry.expires <= now()) remove(id)
      while (size + characters > maxCharacters && entries.size) remove(entries.keys().next().value)
      entries.set(key, { note, size: characters, expires: now() + ttlMs }); size += characters
    },
    clear() { entries.clear(); size = 0 },
  }
}
