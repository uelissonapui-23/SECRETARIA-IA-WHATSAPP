import { Bell, Bot, CalendarDays, ClipboardList, Home, LogOut, Settings, Users } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCompany } from '../company/CompanyProvider'

const items = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/trabalho', label: 'Trabalho', icon: ClipboardList },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/secretaria', label: 'Secretária', icon: Bot },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function AppShell() {
  const { signOut } = useAuth()
  const { currentCompany } = useCompany()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    try { await signOut(); navigate('/auth/login', { replace: true }) }
    finally { setBusy(false) }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">S</div><div><strong>Secretária IA</strong><span>V1</span></div></div>
        <nav>{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
        <button type="button" className="sidebar-logout" onClick={logout} disabled={busy}><LogOut size={18}/><span>{busy?'Saindo...':'Sair'}</span></button>
      </aside>
      <main className="main-area">
        <header className="topbar"><div><strong>{currentCompany?.name ?? 'Minha empresa'}</strong><span>Secretária em modo observação</span></div><button className="icon-button" aria-label="Notificações"><Bell size={20}/></button></header>
        <div className="content"><Outlet /></div>
      </main>
      <nav className="bottom-nav">{items.slice(0,5).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'bottom-link active' : 'bottom-link'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
    </div>
  )
}
