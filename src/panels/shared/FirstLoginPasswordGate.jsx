import { useAuth } from '../../context/useAuth'
import ThemeProvider from '../../theme/ThemeProvider'
import ChangePasswordDialog from '../layout/ChangePasswordDialog'

export default function FirstLoginPasswordGate() {
  const { authUser, refreshSession, logout } = useAuth()
  return (
    <ThemeProvider fixedTheme="techcoach">
      <ChangePasswordDialog key={authUser.id} required onSaved={refreshSession} onClose={refreshSession} onLogout={logout} />
    </ThemeProvider>
  )
}
