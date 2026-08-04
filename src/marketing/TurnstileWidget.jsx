import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let scriptLoadPromise = null

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script yüklenemedi.'))
    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

const TurnstileWidget = forwardRef(function TurnstileWidget({ onToken, onExpire, onError }, ref) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }))

  useEffect(() => {
    if (!siteKey) return undefined

    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          size: 'flexible',
          callback: (token) => onToken(token),
          'error-callback': () => onError?.(),
          'expired-callback': () => onExpire?.(),
        })
      })
      .catch((error) => {
        console.error('Turnstile yüklenemedi', error)
        onError?.()
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) return null

  return <div ref={containerRef} className="turnstile-widget" />
})

export default TurnstileWidget
