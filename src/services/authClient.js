const DEFAULT_AUTH_TIMEOUT_MS = 8000

export async function authRequest(path, options = {}) {
  const { headers, timeoutMs = DEFAULT_AUTH_TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(headers || {}),
      },
      signal: controller.signal,
      ...fetchOptions,
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : {}

    if (!response.ok) {
      const fallbackMessage =
        response.status >= 500 && !contentType.includes('application/json')
          ? 'Kimlik doğrulama servisine ulaşılamadı. API sunucusunun çalıştığını kontrol edin.'
          : 'İşlem tamamlanamadı.'

      throw new Error(data.error || fallbackMessage)
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Sunucu zamanında yanıt vermedi. Lütfen tekrar deneyin.')
    }

    if (error instanceof TypeError) {
      throw new Error('Kimlik doğrulama servisine ulaşılamadı. API sunucusunun çalıştığını kontrol edin.')
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}
