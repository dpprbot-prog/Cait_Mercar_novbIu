'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Clock, ShoppingCart, DollarSign,
  Shield, Wrench, Building2, Users, Menu, X, Bell, LogOut, Edit
} from 'lucide-react'

const NAV = [
  { href: '/',            label: 'Главная',    icon: LayoutDashboard, roles: ['*'] },
  { href: '/tabel',       label: 'Табель',     icon: Clock,           roles: ['Админ', 'Мастер', 'Бригадир'] },
  { href: '/supply',      label: 'Снабжение',  icon: ShoppingCart,    roles: ['Админ', 'Склад', 'Мастер', 'Бригадир'] },
  { href: '/salary',      label: 'Зарплата',   icon: DollarSign,      roles: ['Админ'] },
  { href: '/siz',         label: 'СИЗ',        icon: Shield,          roles: ['*'] },
  { href: '/tools',       label: 'Инструмент', icon: Wrench,          roles: ['*'] },
  { href: '/objects',     label: 'Объекты',    icon: Building2,       roles: ['Админ'] },
  { href: '/employees',   label: 'Сотрудники', icon: Users,           roles: ['Админ'] },
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
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  const [showProfile, setShowProfile] = useState(false)
  const [pH, setPH] = useState(user?.height ? String(user.height) : '')
  const [pC, setPC] = useState(user?.clothing_size || '')
  const [pS, setPS] = useState(user?.shoe_size ? String(user.shoe_size) : '')

  const handleUpdateProfile = async () => {
    const res = await updateProfile({
      height: parseInt(pH) || 0,
      clothingSize: pC,
      shoeSize: pS
    })
    if (res.success) {
      setShowProfile(false)
      window.location.reload()
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
                  {user.name} <Edit size={10} style={{ opacity: 0.5 }} />
                </strong>
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
          <div className="card" style={{ maxWidth: 400, width: '100%', position: 'relative' }}>
            <button onClick={() => setShowProfile(false)} style={{ position: 'absolute', top: 15, right: 15, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            <h2 style={{ color: '#fff', marginBottom: 20, fontSize: 20 }}>Ваш профиль</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <button className="bell-btn">
              <Bell size={16} />
              <span className="badge" />
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="page">
          {children}
        </main>
      </div>
    </div>
  )
}
