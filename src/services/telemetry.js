import { ApplicationInsights } from '@microsoft/applicationinsights-web'

// Frontend hata izleme: backend tarafı Azure Functions host'unun kendi App Insights
// entegrasyonuyla (APPLICATIONINSIGHTS_CONNECTION_STRING app setting) otomatik toplanıyor,
// ama tarayıcıda oluşan JS hataları (render hatası, yakalanmamış exception, promise
// rejection) sunucuya hiç uğramadığı için ayrı bir istemci taraflı SDK gerekiyor. Bağlantı
// dizesi (VITE_APPINSIGHTS_CONNECTION_STRING) gizli değil — GA measurement ID gibi genel
// bir alım (ingestion) anahtarı, client bundle'da bulunması beklenen bir değer.
const connectionString = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING

let appInsights = null

export function initTelemetry() {
  if (!connectionString || appInsights) return

  appInsights = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
      // Varsayılan: window.onerror + unhandledrejection otomatik yakalanır (aşağıdaki
      // trackException, React render hataları gibi bunun kaçırdığı durumlar için).
      disableExceptionTracking: false,
    },
  })
  appInsights.loadAppInsights()
}

// ErrorBoundary'nin componentDidCatch'i gibi React'in kendi hata sınırının yakaladığı
// render hataları window.onerror'a hiç düşmez (React onları kendi içinde tüketir) —
// bu yüzden ayrıca elle bildirilmeleri gerekir.
export function trackException(error, extraProps) {
  if (!appInsights) {
    console.error('[telemetry] App Insights başlatılmadan hata izlendi:', error)
    return
  }
  appInsights.trackException({ exception: error, properties: extraProps })
}
