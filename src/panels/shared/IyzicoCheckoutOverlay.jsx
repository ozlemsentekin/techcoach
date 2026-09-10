import { useEffect, useRef } from 'react'
import { injectCheckoutFormContent } from '../../marketing/iyzicoCheckoutForm'

// iyzico'nun abonelik ödeme formu kendi kartını, başlığını ve kapatma butonunu
// tek kolonlu (~450px) sabit bir düzende basıyor; genişliği bizim tarafımızdan
// değiştirilemiyor. Bu yüzden formun etrafına kendi modal çerçevemizi
// (başlık, yardım metni, alt bar, ekstra kapatma butonu) sarmıyoruz — sadece
// koyu bir zemin veriyoruz. Kapatma: zemine tıklama, Esc veya iyzico'nun kendi
// X butonu.
export default function IyzicoCheckoutOverlay({ content, onClose }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (content && containerRef.current) {
      injectCheckoutFormContent(containerRef.current, content)
    }
  }, [content])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div
        className="flex min-h-full items-start justify-center p-4 sm:items-center"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div ref={containerRef} className="w-full max-w-md" />
      </div>
    </div>
  )
}
