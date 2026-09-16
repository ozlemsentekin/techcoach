import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App.jsx'
import ErrorBoundary from './panels/shared/ErrorBoundary.jsx'
import { initNativeShell } from './native/initNative.js'
import { initTelemetry } from './services/telemetry.js'

initNativeShell()
initTelemetry()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
