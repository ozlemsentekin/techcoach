import { useEffect, useMemo, useState } from 'react'
import { authRequest } from '../services/authClient'
import AuthContext from './authContextObject'

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

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
        timeoutMs: 10000,
      })
      setAuthUser(data.user)
      setAuthMessage('Giriş başarılı. Oturumunuz güvenli çerez ile açıldı.')
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
        timeoutMs: 10000,
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
      setAuthUser(null)
      setAuthMessage('Oturum kapatıldı.')
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
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
      clearAuthFeedback,
      setAuthError,
    }),
    [authUser, sessionLoading, authLoading, authError, authMessage],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
