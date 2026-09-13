import { Component } from 'react'

// Admin<->panel geçişleri (impersonate/returnToAdmin) gibi authUser değişince yeniden render
// eden yerlerde yakalanmamış bir hata olursa React 18 varsayılanı tüm ağacı unmount edip #root'u
// boş bırakır (sessiz beyaz ekran). Bu boundary onun yerine geri dönülebilir bir mesaj gösterir.
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Yakalanmamış render hatası:', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-panel-bg px-6 text-center">
        <p className="text-base font-medium text-panel-text">Bir şeyler ters gitti.</p>
        <p className="max-w-sm text-sm text-panel-text-muted">
          Sayfa beklenmedik bir hatayla karşılaştı. Yeniden yükleyip tekrar deneyebilirsiniz.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-panel-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Sayfayı Yenile
        </button>
      </div>
    )
  }
}
