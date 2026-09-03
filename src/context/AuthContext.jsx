import { useEffect, useMemo, useState } from 'react'
import { authRequest, invalidateCache, setAccountDisabledHandler, setConsentRequiredHandler } from '../services/authClient'
import AuthContext from './authContextObject'

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    // Herhangi bir API çağrısı backend'den CONSENT_REQUIRED dönerse (ör. onay durumu
    // sunucu tarafında güncel değil), authUser.needsConsent'i işaretleyip RequireRole'ün
    // ConsentGate'i göstermesini sağlar — düz bir hata banner'ı yerine gerçek onay ekranı açılır.
    setConsentRequiredHandler(() => {
      setAuthUser((current) => (current && !current.needsConsent ? { ...current, needsConsent: true } : current))
    })
    // Hesap admin panelinden pasife alındıysa (ACCOUNT_DISABLED) oturumu anında kapat.
    setAccountDisabledHandler(() => {
      setAuthUser(null)
      invalidateCache()
      setAuthError('Hesabınız pasife alınmış. Erişim için site yöneticisiyle iletişime geçin.')
    })
    return () => {
      setConsentRequiredHandler(null)
      setAccountDisabledHandler(null)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    const loadSession = async () => {
      try {
        const data = await authRequest('/api/auth/me', { method: 'GET', timeoutMs: 3000 })
        if (!ignore) {
          setAuthUser(data.user)
        }
      } catch {
        if (!ignore) {
          setAuthUser(null)
        }
      } finally {
        if (!ignore) {
          setSessionLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      ignore = true
    }
  }, [])

  const clearAuthFeedback = () => {
    setAuthError('')
    setAuthMessage('')
  }

  const login = async (payload) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const data = await authRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      invalidateCache()
      setAuthUser(data.user)
      setAuthMessage('Giriş başarılı.')
      return data.user
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const register = async (payload) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const data = await authRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setAuthUser(data.user)
      setAuthMessage('Üyelik oluşturuldu ve giriş yapıldı.')
      return data.user
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = async () => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      await authRequest('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
        timeoutMs: 10000,
      })
      invalidateCache()
      setAuthUser(null)
      setAuthMessage('Oturum kapatıldı.')
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const acceptConsent = async () => {
    setAuthLoading(true)
    setAuthError('')

    try {
      await authRequest('/api/auth/consent', {
        method: 'POST',
        body: JSON.stringify({ acceptAydinlatma: true, acceptKvkk: true }),
      })
      const data = await authRequest('/api/auth/me', { method: 'GET' })
      setAuthUser(data.user)
      return data.user
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const refreshSession = async () => {
    const data = await authRequest('/api/auth/me', { method: 'GET' })
    setAuthUser(data.user)
    return data.user
  }

  const enterStudent = async (studentId) => {
    const data = await authRequest(`/api/parent/students/${studentId}/enter`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    invalidateCache()
    setAuthUser(data.user)
    return data.user
  }

  const returnToParent = async () => {
    const data = await authRequest('/api/parent/return', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    invalidateCache()
    setAuthUser(data.user)
    return data.user
  }

  const impersonateUser = async (userId) => {
    const data = await authRequest(`/api/panel-admin/users/${userId}/impersonate`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    invalidateCache()
    setAuthUser(data.user)
    return data.user
  }

  const returnToAdmin = async () => {
    const data = await authRequest('/api/panel-admin/return-to-admin', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    invalidateCache()
    setAuthUser(data.user)
    return data.user
  }

  const value = useMemo(
    () => ({
      authUser,
      sessionLoading,
      authLoading,
      authError,
      authMessage,
      login,
      register,
      logout,
      acceptConsent,
      refreshSession,
      enterStudent,
      returnToParent,
      impersonateUser,
      returnToAdmin,
      clearAuthFeedback,
      setAuthError,
    }),
    [authUser, sessionLoading, authLoading, authError, authMessage],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
