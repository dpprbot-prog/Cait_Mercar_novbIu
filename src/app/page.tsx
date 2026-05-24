'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { Clock, ShoppingCart, Users, DollarSign, AlertTriangle, Wrench } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getDashboardStats } from '@/actions/common'
import { getSupplyOrders, Order } from '@/actions/supply'
import { getAuditLogs, AuditLog } from '@/actions/history'
import { HistoryFeed } from '@/components/HistoryFeed'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    todayHours: 0,
    activeOrders: 0,
    urgentOrders: 0,
    brigadeSize: 0,
    checkedInCount: 0,
    brigadeName: '',
    brigadeMembers: [] as any[],
    sizAlerts: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [globalLogs, setGlobalLogs] = useState<AuditLog[]>([])
  const [brigadeFilter, setBrigadeFilter] = useState<'all' | 'checkedIn'>('all')

  useEffect(() => {
    if (user) {
      getDashboardStats(user.id).then(setStats)
      getSupplyOrders().then(orders => setRecentOrders(orders.slice(0, 3)))
      getAuditLogs({ limit: 10 }).then(setGlobalLogs)
      
      const savedFilter = localStorage.getItem('merkare_brigade_filter')
      if (savedFilter === 'all' || savedFilter === 'checkedIn') {
        setBrigadeFilter(savedFilter)
      } else if (user.role === 'Админ') {
        setBrigadeFilter('checkedIn')
      }
    }
  }, [user])

  const rawTotalHoursToday = stats.brigadeMembers.reduce((sum, m) => {
    if (m.hasCheckedIn && m.details?.total) {
      return sum + Number(m.details.total)
    }
    return sum
  }, 0)
  const totalHoursToday = Math.round(rawTotalHoursToday * 100) / 100

  const filteredMembers = stats.brigadeMembers.filter(m => {
    if (brigadeFilter === 'checkedIn') return m.hasCheckedIn
    return true
  })

  const STATS_CARDS = [
    {
      label: 'Мои часы сегодня',
      value: `${stats.todayHours} ч`,
      sub: 'За сегодня',
      icon: Clock,
      color: 'var(--accent)',
      bg: 'var(--accent-dim)',
    },
    {
      label: 'Активные заявки',
      value: String(stats.activeOrders),
      sub: `${stats.urgentOrders} срочных`,
      icon: ShoppingCart,
      color: 'var(--blue)',
      bg: 'var(--blue-dim)',
    },
    {
      label: 'Бригада',
      value: `${stats.brigadeSize} чел`,
      sub: `${stats.checkedInCount} отметились ✓`,
      icon: Users,
      color: 'var(--green)',
      bg: 'var(--green-dim)',
    },
    {
      label: 'СИЗ Предупреждения',
      value: String(stats.sizAlerts),
      sub: 'Требуют внимания',
      icon: AlertTriangle,
      color: 'var(--yellow)',
      bg: 'var(--yellow-dim)',
    },
  ]

  const PRIORITY_LABEL: Record<string, string> = {
    urgent:  'СРОЧНО',
    days:    '1-3 ДНЯ',
    week:    'НЕДЕЛЯ',
    planned: 'ПЛАНОВО',
  }
  const PRIORITY_CLASS: Record<string, string> = {
    urgent:  'badge-pill badge-red',
    days:    'badge-pill badge-yellow',
    week:    'badge-pill badge-blue',
    planned: 'badge-pill badge-green',
  }

  return (
    <AppLayout>
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-left">
          <h2 style={{textTransform:'uppercase'}}>Добро пожаловать, {user?.name || 'Загрузка...'}</h2>
          <p>{user?.role} &nbsp;·&nbsp; {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="welcome-pills">
          {(user?.role !== 'Админ' || (stats.brigadeName !== '—' && stats.brigadeName !== 'b3')) && (
            <div className="welcome-pill">Бригада: <span>{stats.brigadeName}</span></div>
          )}
          <div className="welcome-pill">Заявок: <span>{stats.activeOrders}</span></div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        {STATS_CARDS.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon" style={{ background: bg, color }}>
              <Icon size={18} />
            </div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Tabель + Supply */}
      <div className="two-col">
        {/* Tabel */}
        <div className="card">
          <div className="card-title">
            <span>Бригада сегодня</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Filter segmented control */}
              <div style={{
                display: 'inline-flex',
                background: 'var(--bg-elevated)',
                padding: 2,
                borderRadius: 6,
                border: '1px solid var(--border-light)'
              }}>
                <button
                  onClick={() => {
                    setBrigadeFilter('all')
                    localStorage.setItem('merkare_brigade_filter', 'all')
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: brigadeFilter === 'all' ? 'var(--accent)' : 'transparent',
                    color: brigadeFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  Все ({stats.brigadeSize})
                </button>
                <button
                  onClick={() => {
                    setBrigadeFilter('checkedIn')
                    localStorage.setItem('merkare_brigade_filter', 'checkedIn')
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: brigadeFilter === 'checkedIn' ? 'var(--accent)' : 'transparent',
                    color: brigadeFilter === 'checkedIn' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  С часами ({stats.checkedInCount})
                </button>
              </div>
              <a href="/tabel" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                Подробнее →
              </a>
            </div>
          </div>
          <div style={{padding: '0 0 16px 0'}}>
            <div style={{
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: 11, 
              color: 'var(--text-muted)', 
              marginBottom: 12, 
              padding: '0 16px', 
              textTransform: 'uppercase', 
              fontWeight: 700, 
              letterSpacing: 0.5
            }}>
              <span>Всего: {stats.brigadeSize} · Отметились: {stats.checkedInCount}</span>
              <span style={{ color: 'var(--green)' }}>Часов сегодня: {totalHoursToday} ч</span>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:2}}>
              {filteredMembers.length === 0 ? (
                <div style={{padding:'20px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13}}>
                  {brigadeFilter === 'checkedIn' ? 'Никто еще не ввел часы сегодня' : 'Бригада не назначена'}
                </div>
              ) : (
                filteredMembers.map(m => (
                  <div key={m.id} style={{display:'flex', flexDirection:'column', padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.02)', transition:'background 0.2s'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.01)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: m.hasCheckedIn ? 8 : 0}}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <div style={{width:30, height:30, borderRadius:8, background: m.user_color || 'var(--bg-elevated)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800}}>
                          {m.initials}
                        </div>
                        <div>
                          <div style={{fontSize:13, fontWeight:700, color: m.hasCheckedIn ? '#fff' : 'var(--text-muted)'}}>{m.name}</div>
                          <div style={{fontSize:10, color:'var(--text-muted)'}}>{m.role}{m.brigade_name ? ` · ${m.brigade_name}` : ''}</div>
                        </div>
                      </div>
                      
                      {m.hasCheckedIn ? (
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:14, fontWeight:900, color:'var(--green)'}}>{m.details.total} ч</div>
                          <div style={{fontSize:10, color:'var(--text-muted)', fontWeight:600}}>ОТРАБОТАНО</div>
                        </div>
                      ) : (
                        <div style={{fontSize:10, color:'rgba(255,255,255,0.1)', fontWeight:700}}>НЕ ОТМЕТИЛСЯ</div>
                      )}
                    </div>

                    {m.hasCheckedIn && (
                      <div style={{display:'flex', alignItems:'center', gap:16, background:'rgba(255,255,255,0.03)', padding:'6px 10px', borderRadius:6, marginTop:2}}>
                        <div style={{display:'flex', alignItems:'center', gap:4}}>
                          <Clock size={10} color="var(--accent)"/>
                          <span style={{fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600}}>{m.details.start} – {m.details.end}</span>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:4}}>
                          <div style={{width:4, height:4, borderRadius:'50%', background:'rgba(255,255,255,0.2)'}}></div>
                          <span style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>Обед: {m.details.lunch} мин</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Supply */}
        <div className="card">
          <div className="card-title">
            Последние заявки
            <a href="/supply" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
              Все →
            </a>
          </div>
          {recentOrders.length === 0 && <div style={{padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13}}>Нет активных заявок</div>}
          {recentOrders.map(item => (
            <div className="supply-item" key={item.id}>
              <div className="supply-item-top">
                <span className="supply-item-num">#{item.id} · {item.object}</span>
                <span className={PRIORITY_CLASS[item.priority]}>{PRIORITY_LABEL[item.priority]}</span>
              </div>
              <div className="supply-item-name">{item.items?.[0]?.name || 'Без названия'} {item.items.length > 1 ? `+ еще ${item.items.length-1}` : ''}</div>
              <div className="supply-item-status">{item.items?.[0]?.mStatus === 'new' ? 'Ожидает снабжения' : 'В обработке'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SIZ warnings + Tools */}
      <div className="two-col">
        <div className="card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} color="var(--orange)" /> Предупреждения СИЗ
            </span>
          </div>
          <div style={{padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13}}>
            {stats.sizAlerts > 0 ? `Найдено ${stats.sizAlerts} уведомлений по СИЗ` : 'Нет срочных предупреждений'}
            <br/><a href="/siz" style={{color:'var(--accent)', fontSize:12, marginTop:8, display:'inline-block'}}>Перейти в СИЗ →</a>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wrench size={14} /> Инструмент
            </span>
          </div>
          <div style={{padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13}}>
            Управление инвентарем и выдачей.
            <br/><a href="/tools" style={{color:'var(--accent)', fontSize:12, marginTop:8, display:'inline-block'}}>Открыть склад →</a>
          </div>
        </div>
      </div>

      {user && ['Админ', 'Склад', 'Мастер', 'Снабженец', 'Снабжение'].includes(user.role) && (
        <div style={{marginTop:24}}>
          <HistoryFeed logs={globalLogs} />
        </div>
      )}
    </AppLayout>
  )
}
