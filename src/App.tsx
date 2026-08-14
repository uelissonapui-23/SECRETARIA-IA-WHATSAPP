import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AppGuard } from './components/AppGuard'
import { DashboardPage } from './pages/DashboardPage'
import { AgendaPage } from './pages/AgendaPage'
import { WorkPage } from './pages/WorkPage'
import { ClientsPage } from './pages/ClientsPage'
import { SecretaryPage } from './pages/SecretaryPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { AuthLayout } from './pages/auth/AuthLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { ConfirmedPage } from './pages/auth/ConfirmedPage'
import { envReady } from './lib/env'

export function App() {
  if (!envReady) return <SetupPage />

  return (
    <Routes>
      <Route path="auth" element={<AuthLayout />}>
        <Route index element={<Navigate to="login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="cadastro" element={<SignupPage />} />
        <Route path="esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="nova-senha" element={<ResetPasswordPage />} />
        <Route path="confirmado" element={<ConfirmedPage />} />
      </Route>
      <Route path="onboarding" element={<AppGuard><OnboardingPage /></AppGuard>} />
      <Route element={<AppGuard><AppShell /></AppGuard>}>
        <Route index element={<DashboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="trabalho" element={<WorkPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="secretaria" element={<SecretaryPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
