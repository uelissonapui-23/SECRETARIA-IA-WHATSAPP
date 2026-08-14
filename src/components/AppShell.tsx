import { Bell, Bot, CalendarDays, ClipboardList, Home, LogOut, MessageCircle, MoreHorizontal, Settings, Users, X } from 'lucide-react'
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
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function AppShell() {
  const { signOut } = useAuth()
  const { currentCompany } = useCompany()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

  async function logout() {
    setBusy(true)
    try { await signOut(); navigate('/auth/login', { replace: true }) }
    finally { setBusy(false); setMobileMenu(false) }
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

      {mobileMenu && <div className="mobile-more-backdrop" onClick={()=>setMobileMenu(false)}>
        <div className="mobile-more-sheet" onClick={(event)=>event.stopPropagation()}>
          <div className="mobile-more-head"><strong>Mais opções</strong><button className="icon-button" onClick={()=>setMobileMenu(false)} aria-label="Fechar"><X size={19}/></button></div>
          <div className="mobile-more-links">{items.slice(4).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={()=>setMobileMenu(false)} className={({ isActive }) => isActive ? 'mobile-more-link active' : 'mobile-more-link'}><Icon size={20}/><span>{label}</span></NavLink>)}</div>
          <button type="button" className="mobile-more-link danger" onClick={logout} disabled={busy}><LogOut size={20}/><span>{busy?'Saindo...':'Sair'}</span></button>
        </div>
      </div>}

      <nav className="bottom-nav">
        {items.slice(0,4).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'bottom-link active' : 'bottom-link'}><Icon size={19}/><span>{label}</span></NavLink>)}
        <button type="button" className={mobileMenu?'bottom-link active':'bottom-link'} onClick={()=>setMobileMenu(true)}><MoreHorizontal size={20}/><span>Mais</span></button>
      </nav>
    </div>
  )
}
