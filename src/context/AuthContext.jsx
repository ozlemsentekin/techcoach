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

  const requestOtp = async (payload) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const data = await authRequest('/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 10000,
      })
      setAuthMessage(
        data.smsDisabled
          ? 'Doğrulama kodu olarak telefon numaranızın son 6 hanesini girin.'
          : 'Doğrulama kodu telefonunuza gönderildi.',
      )
      return data
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const verifyOtp = async (payload) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const data = await authRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 10000,
      })
      setAuthUser(data.user)
      setAuthMessage(
        payload.purpose === 'register' ? 'Üyelik oluşturuldu ve giriş yapıldı.' : 'Giriş başarılı.',
      )
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

  const enterStudent = async (studentId) => {
    const data = await authRequest(`/api/parent/students/${studentId}/enter`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    setAuthUser(data.user)
    return data.user
  }

  const returnToParent = async () => {
    const data = await authRequest('/api/parent/return', {
      method: 'POST',
      body: JSON.stringify({}),
    })
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
      requestOtp,
      verifyOtp,
      logout,
      enterStudent,
      returnToParent,
      clearAuthFeedback,
      setAuthError,
    }),
    [authUser, sessionLoading, authLoading, authError, authMessage],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
