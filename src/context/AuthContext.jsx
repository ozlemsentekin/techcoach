import { useEffect, useMemo, useState } from 'react'
import {
  authRequest,
  invalidateCache,
  setAccountDisabledHandler,
  setConsentRequiredHandler,
  setPasswordChangeRequiredHandler,
} from '../services/authClient'
import AuthContext from './authContextObject'

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    // Herhangi bir API çağrısı backend'den PASSWORD_CHANGE_REQUIRED dönerse (ör. hesap hâlâ
    // varsayılan şifredeyken bir panel isteği yapılırsa), authUser.mustChangePassword'ü
    // işaretleyip App.jsx'in FirstLoginPasswordGate'i göstermesini sağlar.
    setPasswordChangeRequiredHandler(() => {
      setAuthUser((current) => current ? { ...current, mustChangePassword: true } : current)
    })
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
      setPasswordChangeRequiredHandler(null)
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

  // Kayıt telefon doğrulaması ve (nadiren gereken) giriş ikinci faktörü için SMS kodu
  // gönderir. purpose='register' henüz kayıtlı olmayan bir telefon için; purpose='login'
  // sadece login() 'requiresOtp: true' döndüğünde (hesap hâlâ varsayılan şifredeyken)
  // devreye girer — normal girişte hiç çağrılmaz.
  const requestOtp = async (purpose, phone, turnstileToken) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      return await authRequest('/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ purpose, phone, turnstileToken }),
      })
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  // Telefon + 6 haneli şifre ile giriş. Hesap hâlâ varsayılan (telefonun son 6 hanesi)
  // şifredeyse backend oturum açmadan { requiresOtp: true } döner — bu durumda çağıran
  // requestOtp('login', …) + verifyLoginOtp() ile phoneVerifiedToken alıp login()'i o
  // token'la tekrar çağırmalı.
  const login = async (phone, password, phoneVerifiedToken) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const data = await authRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password, phoneVerifiedToken }),
      })
      if (data.requiresOtp) {
        return data
      }
      invalidateCache()
      setAuthUser(data.user)
      setAuthMessage('Giriş başarılı.')
      return data
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  // Kayıt/giriş-ikinci-faktör kodunu doğrular — hesap açmaz/oturum başlatmaz, sadece telefon
  // sahipliğini kanıtlayan kısa ömürlü bir token döner. purpose='register' için register()'a,
  // purpose='login' için login()'in üçüncü parametresine geçirilir.
  const verifyPhoneOtp = async (purpose, phone, code) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      return await authRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ purpose, phone, code }),
      })
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const verifyLoginOtp = (phone, code) => verifyPhoneOtp('login', phone, code)
  const verifyRegisterOtp = (phone, code) => verifyPhoneOtp('register', phone, code)

  // Şifremi unuttum akışı: telefona OTP gönder → kodu doğrula (60sn'lik resetToken alınır)
  // → yeni şifreyi onayla (oturum doğrudan açılır).
  const requestPasswordReset = async (phone, turnstileToken) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      return await authRequest('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ phone, turnstileToken }),
      })
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const verifyPasswordResetOtp = async (phone, code) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      return await authRequest('/api/auth/password-reset/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      })
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const confirmPasswordReset = async (resetToken, newPassword) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const data = await authRequest('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ resetToken, newPassword }),
      })
      invalidateCache()
      setAuthUser(data.user)
      setAuthMessage('Şifreniz güncellendi ve giriş yapıldı.')
      return data.user
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      await authRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      invalidateCache()
      setAuthUser((current) => (current ? { ...current, mustChangePassword: false } : current))
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
      requestOtp,
      login,
      verifyLoginOtp,
      verifyRegisterOtp,
      requestPasswordReset,
      verifyPasswordResetOtp,
      confirmPasswordReset,
      changePassword,
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
