'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { Clock, ShoppingCart, Users, DollarSign, AlertTriangle, Wrench } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getDashboardStats } from '@/actions/common'
import { getSupplyOrders, Order } from '@/actions/supply'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    todayHours: 0,
    activeOrders: 0,
    urgentOrders: 0,
    brigadeSize: 0,
    checkedInCount: 0,
    sizAlerts: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])

  useEffect(() => {
    if (user) {
      getDashboardStats(user.id).then(setStats)
      getSupplyOrders().then(orders => setRecentOrders(orders.slice(0, 3)))
    }
  }, [user])

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
          <div className="welcome-pill">Бригада: <span>{user?.brigade_id || '—'}</span></div>
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
            Бригада сегодня
            <a href="/tabel" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
              Подробнее →
            </a>
          </div>
          <div className="table-wrap">
            <p style={{fontSize:12, color:'var(--text-muted)', marginBottom:10}}>Всего в бригаде: {stats.brigadeSize} чел. Отметились: {stats.checkedInCount}.</p>
            {stats.checkedInCount === 0 && <div style={{padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13}}>Сегодня 아직 никто не отметился</div>}
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
    </AppLayout>
  )
}
