'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Clock, ShoppingCart, DollarSign,
  Shield, Wrench, Building2, Users, Menu, X, Bell, LogOut, Edit, Settings, History, HandCoins, Lock
} from 'lucide-react'
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  getNotificationSettings, 
  updateNotificationSettings,
  approvePendingTimeEntry,
  rejectPendingTimeEntry
} from '@/actions/notifications'
import { updateWorkerAdmin, deployFromServer, updateProfileSelf } from '@/actions/admin'
import Modal from './Modal'

const NAV = [
  { href: '/',            label: 'Главная',    icon: LayoutDashboard, roles: ['*'] },
  { href: '/tabel',       label: 'Табель',     icon: Clock,           roles: ['*'] },
  { href: '/supply',      label: 'Снабжение',  icon: ShoppingCart,    roles: ['Админ', 'Склад', 'Мастер', 'Бригадир'] },
  { href: '/salary',      label: 'Зарплата',   icon: DollarSign,      roles: ['Админ'] },
  { href: '/advances',    label: 'Авансы',     icon: HandCoins,       roles: ['Админ'] },
  { href: '/siz',         label: 'СИЗ',        icon: Shield,          roles: ['*'] },
  { href: '/tools',       label: 'Инструмент', icon: Wrench,          roles: ['*'] },
  { href: '/objects',     label: 'Объекты',    icon: Building2,       roles: ['Админ'] },
  { href: '/employees',   label: 'Сотрудники', icon: Users,           roles: ['Админ'] },
  { href: '/history',     label: 'История',    icon: History,         roles: ['Админ', 'Склад', 'Мастер', 'Снабженец', 'Снабжение'] },
]

import { useAuth } from '@/components/AuthProvider'
import { logout, updateProfile } from '@/actions/auth'

function formatDate() {
  return new Date().toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

const PAGE_TITLES: Record<string, string> = {
  '/':            'Главная',
  '/tabel':       'Учёт времени',
  '/supply':      'Снабжение',
  '/salary':      'Зарплата',
  '/siz':         'СИЗ',
  '/tools':       'Инструмент',
  '/objects':     'Объекты',
  '/employees':   'Сотрудники',
  '/history':     'История событий',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [deployState, setDeployState] = useState<'idle' | 'deploying' | 'success' | 'failed'>('idle')
  const [notifSettings, setNotifSettings] = useState<any>({
    notify_siz: 1,
    notify_supply: 1,
    notify_admin_tasks: 1
  })

  // Modal alert
  const [modal, setModal] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    type: 'danger' | 'info' | 'success' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  useEffect(() => {
    if (user) {
      getNotificationSettings().then(setNotifSettings)
    }
  }, [user])

  const [notifications, setNotifications] = useState<any[]>([])
  useEffect(() => {
    if (!user) return
    getNotifications().then(setNotifications)
    
    // Получение каждую минуту
    const t = setInterval(() => {
      getNotifications().then(setNotifications)
    }, 60000)
    return () => clearInterval(t)
  }, [user])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const handleMarkRead = async (id: number) => {
    await markAsRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    await markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
  }

  const handleToggleSetting = async (key: string) => {
    const newSettings = {
      ...notifSettings,
      [key]: !notifSettings[key]
    }
    setNotifSettings(newSettings)
    await updateNotificationSettings(newSettings)
  }

  const [pH, setPH] = useState(user?.height ? String(user.height) : '')
  const [pC, setPC] = useState(user?.clothing_size || '')
  const [pS, setPS] = useState(user?.shoe_size ? String(user.shoe_size) : '')

  const [pLastName, setPLastName] = useState(user?.last_name || '')
  const [pFirstName, setPFirstName] = useState(user?.first_name || '')
  const [pPatronymic, setPPatronymic] = useState(user?.patronymic || '')

  useEffect(() => {
    if (user) {
      setPLastName(user.last_name || '')
      setPFirstName(user.first_name || '')
      setPPatronymic(user.patronymic || '')
      setPH(user.height ? String(user.height) : '')
      setPC(user.clothing_size || '')
      setPS(user.shoe_size ? String(user.shoe_size) : '')
    }
  }, [showProfile, user])

  // ── ROUTE PROTECTION ──
  useEffect(() => {
    if (user) {
      const currentNav = NAV.find(item => item.href === pathname)
      if (currentNav) {
        const isAllowed = currentNav.roles.includes('*') || currentNav.roles.includes(user.role)
        if (!isAllowed) {
          router.replace('/')
        }
      }
    }
  }, [user, pathname, router])

  const handleUpdateProfile = async () => {
    if (!user) return
    const res = await updateProfileSelf({
      last_name: pLastName,
      first_name: pFirstName,
      patronymic: pPatronymic,
      height: pH ? Number(pH) : null,
      clothing_size: pC,
      shoe_size: pS || null
    })
    
    if (res.success) {
      setModal({ isOpen: true, title: 'Успех', message: 'Профиль успешно обновлен', type: 'success' })
      setTimeout(() => {
        setShowProfile(false)
        window.location.reload()
      }, 1500)
    } else {
      setModal({ isOpen: true, title: 'Ошибка', message: res.error || 'Не удалось сохранить изменения', type: 'danger' })
    }
  }

  const pageTitle = PAGE_TITLES[pathname] ?? 'МЕРКАРЕ'

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <div className="app-layout">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 99, display: 'block'
          }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <strong>МЕРКАРЕ</strong>
            <span>строительная компания</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.filter(item => item.roles.includes('*') || (user?.role && item.roles.includes(user.role))).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${pathname === href ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className="sidebar-user" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div 
              onClick={() => setShowProfile(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}
            >
              <div className="user-avatar" style={{ background: user.user_color }}>{user.initials}</div>
              <div className="user-info">
                <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {`${user.last_name || ''} ${user.first_name || ''} ${user.patronymic || ''}`.trim() || user.name} <Edit size={10} style={{ opacity: 0.5 }} />
                </strong>
                <span style={{ fontSize: 10, opacity: 0.6, display: 'block', marginBottom: 2 }}>
                  {user.login ? `@${user.login}` : 'нет логина'}
                </span>
                <span>{user.role}</span>
              </div>
            </div>
            <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 5 }}>
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Profile Modal */}
      {showProfile && user && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowProfile(false)} style={{ position: 'absolute', top: 15, right: 15, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            <h2 style={{ color: '#fff', marginBottom: 20, fontSize: 20 }}>Ваш профиль</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>ФАМИЛИЯ</label>
                  {user.is_name_locked === 1 && (
                    <span style={{ fontSize: 10, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      <Lock size={10} /> ФИО зафиксировано
                    </span>
                  )}
                </div>
                <input 
                  value={pLastName} 
                  onChange={e => setPLastName(e.target.value)}
                  disabled={user.is_name_locked === 1}
                  placeholder="Фамилия"
                  style={{ 
                    width: '100%', 
                    background: user.is_name_locked === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8, 
                    padding: 12, 
                    color: user.is_name_locked === 1 ? 'rgba(255,255,255,0.4)' : '#fff', 
                    outline: 'none',
                    cursor: user.is_name_locked === 1 ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>ИМЯ</label>
                  {user.is_name_locked === 1 && (
                    <span style={{ fontSize: 10, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      <Lock size={10} /> ФИО зафиксировано
                    </span>
                  )}
                </div>
                <input 
                  value={pFirstName} 
                  onChange={e => setPFirstName(e.target.value)}
                  disabled={user.is_name_locked === 1}
                  placeholder="Имя"
                  style={{ 
                    width: '100%', 
                    background: user.is_name_locked === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8, 
                    padding: 12, 
                    color: user.is_name_locked === 1 ? 'rgba(255,255,255,0.4)' : '#fff', 
                    outline: 'none',
                    cursor: user.is_name_locked === 1 ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>ОТЧЕСТВО</label>
                  {user.is_name_locked === 1 && (
                    <span style={{ fontSize: 10, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      <Lock size={10} /> ФИО зафиксировано
                    </span>
                  )}
                </div>
                <input 
                  value={pPatronymic} 
                  onChange={e => setPPatronymic(e.target.value)}
                  disabled={user.is_name_locked === 1}
                  placeholder="Отчество"
                  style={{ 
                    width: '100%', 
                    background: user.is_name_locked === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8, 
                    padding: 12, 
                    color: user.is_name_locked === 1 ? 'rgba(255,255,255,0.4)' : '#fff', 
                    outline: 'none',
                    cursor: user.is_name_locked === 1 ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>РОСТ (СМ)</label>
                <input 
                  value={pH} 
                  onChange={e => setPH(e.target.value)}
                  placeholder="180"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>РАЗМЕР ОДЕЖДЫ</label>
                <input 
                  list="p-clothing-sizes"
                  value={pC} 
                  onChange={e => setPC(e.target.value)}
                  placeholder="52-54"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none' }}
                />
                <datalist id="p-clothing-sizes">
                  {['S','M','L','XL','XXL','XXXL'].map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>РАЗМЕР ОБУВИ</label>
                <input 
                  value={pS} 
                  onChange={e => setPS(e.target.value)}
                  placeholder="42-43"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="profile-section" style={{marginTop: 20}}>
                <h4 style={{margin:'0 0 12px 0', fontSize:14, opacity:0.7, display:'flex', alignItems:'center', gap:8}}>
                  <Settings size={14}/> Настройки уведомлений
                </h4>
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontSize:13}}>Сроки СИЗ и замены</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!notifSettings?.notify_siz} 
                        onChange={() => handleToggleSetting('notify_siz')}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontSize:13}}>Статус снабжения</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!notifSettings?.notify_supply} 
                        onChange={() => handleToggleSetting('notify_supply')}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  {user.role === 'Админ' && (
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize:13}}>Новые регистрации</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={!!notifSettings?.notify_admin_tasks} 
                          onChange={() => handleToggleSetting('notify_admin_tasks')}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={handleUpdateProfile}
                style={{ 
                  marginTop: 10, background: 'var(--accent)', color: '#fff', border: 'none', 
                  borderRadius: 10, padding: 14, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                СОХРАНИТЬ ИЗМЕНЕНИЯ
              </button>

              {user.role === 'Админ' && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 20 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                    🚀 Обновление сайта на сервере
                  </h4>
                  <button 
                    onClick={async () => {
                      if (window.confirm('Вы уверены, что хотите обновить код с GitHub и перезапустить сервер? Процесс займет около 15 секунд.')) {
                        setDeployState('deploying')
                        const res = await deployFromServer()
                        if (res.success) {
                          setDeployState('success')
                          setTimeout(() => window.location.reload(), 15000)
                        } else {
                          setDeployState('idle')
                          alert(res.error || 'Ошибка при обновлении')
                        }
                      }
                    }}
                    disabled={deployState === 'deploying' || deployState === 'success'}
                    style={{ 
                      width: '100%', background: deployState === 'deploying' ? 'var(--orange)' : deployState === 'success' ? 'var(--green)' : 'var(--blue)', color: '#fff', border: 'none', 
                      borderRadius: 10, padding: 14, fontWeight: 800, cursor: deployState === 'deploying' || deployState === 'success' ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    {deployState === 'deploying' ? 'ОБНОВЛЕНИЕ И СБОРКА...' : deployState === 'success' ? 'ПЕРЕЗАПУСК САЙТА (15 С)...' : 'СКАЧАТЬ С GITHUB И ОБНОВИТЬ'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="header-title">{pageTitle}</span>
          </div>
          <div className="header-right">
            <span className="header-date">{formatDate()}</span>
            <div style={{position:'relative'}}>
              <button className="bell-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={16} />
                {unreadCount > 0 && <span className="badge" />}
              </button>

              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span>Уведомления</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead}>Прочитать все</button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">Нет уведомлений</div>
                    ) : (
                      notifications.map(n => {
                        const isApproval = n.type && n.type.startsWith('time_approval:')
                        const timeEntryId = isApproval ? parseInt(n.type.split(':')[1], 10) : null
                        
                        return (
                          <div 
                            key={n.id} 
                            className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                            onClick={() => !isApproval && handleMarkRead(n.id)}
                            style={{ cursor: isApproval ? 'default' : 'pointer' }}
                          >
                            <div className="notif-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{n.title}</span>
                              {isApproval && !n.is_read && (
                                <span style={{ background: 'var(--orange)', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>Ожидает</span>
                              )}
                            </div>
                            <div className="notif-message" style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>{n.message}</div>
                            
                            {isApproval && !n.is_read && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                                <button 
                                  onClick={async () => {
                                    await approvePendingTimeEntry(timeEntryId!, n.id)
                                    const fresh = await getNotifications()
                                    setNotifications(fresh)
                                  }}
                                  style={{ flex: 1, padding: '6px 10px', background: 'var(--green)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  Одобрить
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (window.confirm('Отклонить и удалить эту запись времени?')) {
                                      await rejectPendingTimeEntry(timeEntryId!, n.id)
                                      const fresh = await getNotifications()
                                      setNotifications(fresh)
                                    }
                                  }}
                                  style={{ flex: 1, padding: '6px 10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, color: 'var(--red)', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  Отклонить
                                </button>
                              </div>
                            )}
                            
                            <div className="notif-time" style={{ marginTop: isApproval ? 6 : 4, fontSize: 10, opacity: 0.5 }}>
                              {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="page">
          <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
      <Modal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        showConfirm={false}
        cancelText="Закрыть"
      />
    </div>
  )
}
