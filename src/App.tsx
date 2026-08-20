import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AppGuard } from './components/AppGuard'
import { SetupPage } from './pages/SetupPage'
import { AuthLayout } from './pages/auth/AuthLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { ConfirmedPage } from './pages/auth/ConfirmedPage'
import { envReady } from './lib/env'
import { PwaInstallPopup } from './components/PwaInstallPopup'
const DashboardPage=lazy(()=>import('./pages/DashboardPage').then(m=>({default:m.DashboardPage})))
const AgendaPage=lazy(()=>import('./pages/AgendaPage').then(m=>({default:m.AgendaPage})))
const WorkPage=lazy(()=>import('./pages/WorkPage').then(m=>({default:m.WorkPage})))
const ClientsPage=lazy(()=>import('./pages/ClientsPage').then(m=>({default:m.ClientsPage})))
const SecretaryPage=lazy(()=>import('./pages/SecretaryPage').then(m=>({default:m.SecretaryPage})))
const SettingsPage=lazy(()=>import('./pages/SettingsPage').then(m=>({default:m.SettingsPage})))
const WhatsAppPage=lazy(()=>import('./pages/WhatsAppPage').then(m=>({default:m.WhatsAppPage})))
const MasterPage=lazy(()=>import('./pages/MasterPage').then(m=>({default:m.MasterPage})))
const OnboardingPage=lazy(()=>import('./pages/OnboardingPage').then(m=>({default:m.OnboardingPage})))
const page=(node:React.ReactNode)=><Suspense fallback={<section><div className="panel-card">Carregando módulo...</div></section>}>{node}</Suspense>
export function App(){if(!envReady)return <SetupPage/>;return <><Routes><Route path="auth" element={<AuthLayout/>}><Route index element={<Navigate to="login" replace/>}/><Route path="login" element={<LoginPage/>}/><Route path="cadastro" element={<SignupPage/>}/><Route path="esqueci-senha" element={<ForgotPasswordPage/>}/><Route path="nova-senha" element={<ResetPasswordPage/>}/><Route path="confirmado" element={<ConfirmedPage/>}/></Route><Route path="onboarding" element={<AppGuard>{page(<OnboardingPage/>)}</AppGuard>}/><Route element={<AppGuard><AppShell/></AppGuard>}><Route index element={page(<DashboardPage/>)}/><Route path="agenda" element={page(<AgendaPage/>)}/><Route path="trabalho" element={page(<WorkPage/>)}/><Route path="clientes" element={page(<ClientsPage/>)}/><Route path="secretaria" element={page(<SecretaryPage/>)}/><Route path="whatsapp" element={page(<WhatsAppPage/>)}/><Route path="configuracoes" element={page(<SettingsPage/>)}/><Route path="master" element={page(<MasterPage/>)}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes><PwaInstallPopup/></>}
