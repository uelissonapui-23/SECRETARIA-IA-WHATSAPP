import { Bell, Bot, CalendarDays, Check, ClipboardList, Home, LogOut, MessageCircle, MoreHorizontal, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'

const baseItems = [
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
  const { currentCompany, companies, selectCompany } = useCompany()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [platformRole, setPlatformRole] = useState<string|null>(null)
  const [notifications, setNotifications] = useState<Array<{id:string;title:string;body:string|null;link:string|null;read_at:string|null;created_at:string;severity?:string}>>([])

  const items = useMemo(() => platformRole ? [...baseItems, { to:'/master', label:'Área Master', icon:ShieldCheck }] : baseItems, [platformRole])

  const loadNotifications = useCallback(async () => {
    if (!currentCompany) return
    await supabase.rpc('refresh_company_notifications', { target_company_id: currentCompany.id })
    const { data } = await supabase.from('app_notifications').select('id,title,body,link,read_at,created_at,severity').eq('company_id', currentCompany.id).order('created_at', { ascending:false }).limit(16)
    setNotifications((data ?? []) as typeof notifications)
  }, [currentCompany])

  useEffect(() => { void loadNotifications() }, [loadNotifications])
  useEffect(() => { void supabase.rpc('get_my_platform_role').then(({data})=>setPlatformRole((data as string|null)??null)) }, [])

  async function markAllRead() {
    if (!currentCompany) return
    const unreadIds = notifications.filter((item)=>!item.read_at).map((item)=>item.id)
    if (!unreadIds.length) return
    await supabase.from('app_notifications').update({ read_at:new Date().toISOString() }).in('id', unreadIds)
    await loadNotifications()
  }

  async function openNotification(item: typeof notifications[number]) {
    if (!item.read_at) await supabase.from('app_notifications').update({read_at:new Date().toISOString()}).eq('id',item.id)
    setNotificationOpen(false)
    if(item.link) navigate(item.link)
    await loadNotifications()
  }

  const unreadCount = notifications.filter((item)=>!item.read_at).length

  async function logout() {
    setBusy(true)
    try { await signOut(); navigate('/auth/login', { replace: true }) }
    finally { setBusy(false); setMobileMenu(false) }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">S</div><div><strong>Secretária IA</strong><span>Organização inteligente</span></div></div>
        <nav>{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
        <button type="button" className="sidebar-logout" onClick={logout} disabled={busy}><LogOut size={18}/><span>{busy?'Saindo...':'Sair'}</span></button>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="topbar-company">{companies.length > 1 ? <select value={currentCompany?.id ?? ''} onChange={(event)=>void selectCompany(event.target.value)}>{companies.map((company)=><option key={company.id} value={company.id}>{company.name}</option>)}</select> : <strong>{currentCompany?.name ?? 'Minha empresa'}</strong>}<div className="topbar-mode"><span className="mode-dot"/>Secretária em modo observação</div></div><button className="icon-button topbar-bell" aria-label="Notificações" onClick={()=>{setNotificationOpen((v)=>!v);void loadNotifications()}}><Bell size={20}/>{unreadCount>0&&<span className="bell-count">{unreadCount>9?'9+':unreadCount}</span>}</button></header>
        <div className="content"><Outlet /></div>
        {notificationOpen && (
          <div className="notification-popover">
            <div className="notification-head">
              <div><span className="eyebrow">CENTRAL RÁPIDA</span><strong>Notificações</strong></div>
              <button className="icon-button" onClick={() => setNotificationOpen(false)}><X size={17}/></button>
            </div>
            {notifications.length ? (
              <>
                <div className="notification-list">
                  {notifications.map((item) => (
                    <button
                      type="button"
                      onClick={() => void openNotification(item)}
                      className={`${item.read_at ? 'notification-item' : 'notification-item unread'} severity-${item.severity ?? 'info'}`}
                      key={item.id}
                    >
                      <div className="notification-icon">{item.read_at ? <Check size={16}/> : <Sparkles size={16}/>}</div>
                      <div><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}<small>{formatDateTime(item.created_at)}</small></div>
                    </button>
                  ))}
                </div>
                {unreadCount > 0 && <button className="notification-read-all" onClick={() => void markAllRead()}>Marcar tudo como lido</button>}
              </>
            ) : (
              <div className="notification-empty"><Sparkles size={24}/><strong>Tudo tranquilo por aqui</strong><span>Novidades importantes aparecem neste espaço.</span></div>
            )}
          </div>
        )}
      </main>

      {mobileMenu && <div className="mobile-more-backdrop" onClick={()=>setMobileMenu(false)}><div className="mobile-more-sheet" onClick={(event)=>event.stopPropagation()}><div className="mobile-more-head"><strong>Mais opções</strong><button className="icon-button" onClick={()=>setMobileMenu(false)} aria-label="Fechar"><X size={19}/></button></div><div className="mobile-more-links">{items.slice(4).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={()=>setMobileMenu(false)} className={({ isActive }) => isActive ? 'mobile-more-link active' : 'mobile-more-link'}><Icon size={20}/><span>{label}</span></NavLink>)}</div><button type="button" className="mobile-more-link danger" onClick={logout} disabled={busy}><LogOut size={20}/><span>{busy?'Saindo...':'Sair'}</span></button></div></div>}

      <nav className="bottom-nav">{items.slice(0,4).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'bottom-link active' : 'bottom-link'}><Icon size={19}/><span>{label}</span></NavLink>)}<button type="button" className={mobileMenu?'bottom-link active':'bottom-link'} onClick={()=>setMobileMenu(true)}><MoreHorizontal size={20}/><span>Mais</span></button></nav>
    </div>
  )
}
