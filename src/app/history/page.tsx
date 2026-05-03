'use client'
import { useState, useEffect, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { 
  History, Search, Filter, Calendar, User, 
  ChevronLeft, ChevronRight, Download, RefreshCcw,
  Tag, Activity, Shield, ShoppingCart, DollarSign, Wrench, Users, Building2
} from 'lucide-react'
import { getAuditLogs, AuditLog } from '@/actions/history'
import { getWorkers } from '@/actions/common'

const ENTITY_MAP: Record<string, {label:string; icon:any; color:string}> = {
  tool:    { label: 'Инструмент', icon: Wrench,       color: '#eab308' },
  siz:     { label: 'СИЗ',        icon: Shield,       color: '#f97316' },
  supply:  { label: 'Снабжение',  icon: ShoppingCart, color: '#3b82f6' },
  salary:  { label: 'Зарплата',   icon: DollarSign,   color: '#22c55e' },
  worker:  { label: 'Сотрудник',  icon: Users,        color: '#8b5cf6' },
  object:  { label: 'Объект',     icon: Building2,    color: '#06b6d4' },
  brigade: { label: 'Бригада',    icon: Users,        color: '#ec4899' },
  store:   { label: 'Магазин',    icon: Building2,    color: '#64748b' },
}

const ACTION_MAP: Record<string, {label:string; color:string}> = {
  create:   { label: 'СОЗДАНИЕ', color: '#22c55e' },
  update:   { label: 'ИЗМЕНЕНИЕ', color: '#3b82f6' },
  delete:   { label: 'УДАЛЕНИЕ',  color: '#ef4444' },
  transfer: { label: 'ПЕРЕДАЧА',  color: '#f97316' },
  repair:   { label: 'РЕМОНТ',    color: '#eab308' },
  writeoff: { label: 'СПИСАНИЕ',  color: '#64748b' },
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [workers, setWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('all')
  const [actionType, setActionType] = useState('all')
  const [userName, setUserName] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const loadData = async () => {
    setLoading(true)
    const [auditData, workersData] = await Promise.all([
      getAuditLogs({
        entity_type: entityType,
        action_type: actionType,
        user_name: userName === 'all' ? undefined : userName,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
        limit,
        offset: page * limit
      }),
      getWorkers()
    ])
    setLogs(auditData)
    setWorkers(workersData)
    setLoading(false)
  }

  const handleExport = () => {
    const headers = ['Дата', 'Пользователь', 'Раздел', 'Действие', 'Детали', 'ID']
    const rows = logs.map(l => [
      new Date(l.created_at).toLocaleString('ru-RU'),
      l.user_name,
      ENTITY_MAP[l.entity_type]?.label || l.entity_type,
      ACTION_MAP[l.action_type]?.label || l.action_type,
      l.details.replace(/"/g, '""'),
      l.entity_id || ''
    ])
    
    const csvContent = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `history_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  useEffect(() => {
    loadData()
  }, [entityType, actionType, userName, startDate, endDate, page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    loadData()
  }

  const resetFilters = () => {
    setSearch('')
    setEntityType('all')
    setActionType('all')
    setUserName('all')
    setStartDate('')
    setEndDate('')
    setPage(0)
  }

  return (
    <AppLayout>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={24} color="var(--accent)" /> Полная история событий
        </h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} onClick={resetFilters}>
            <RefreshCcw size={14} /> Сбросить
          </button>
          <button className="btn btn-sm" style={{ background: '#22c55e22', border: '1px solid #22c55e44', color: '#22c55e' }} onClick={handleExport}>
            <Download size={14} /> Экспорт CSV
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div style={{ 
        background: 'var(--bg-surface)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius)', 
        padding: 20, 
        marginBottom: 20 
      }}>
        <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Search */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>Поиск по деталям</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input 
                placeholder="Что искать? (напр. название предмета, ID...)" 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px 10px 36px', fontSize: 14, color: '#fff', outline: 'none' }}
              />
            </div>
          </div>

          {/* User Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>Кто выполнил</label>
            <select 
              value={userName} 
              onChange={e => setUserName(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#fff', outline: 'none' }}
            >
              <option value="all">Все пользователи</option>
              <option value="Админ">Админ</option>
              <option value="Склад">Склад</option>
              {workers.map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>Раздел</label>
            <select 
              value={entityType} 
              onChange={e => setEntityType(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#fff', outline: 'none' }}
            >
              <option value="all">Все разделы</option>
              {Object.entries(ENTITY_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>Тип действия</label>
            <select 
              value={actionType} 
              onChange={e => setActionType(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#fff', outline: 'none' }}
            >
              <option value="all">Все действия</option>
              {Object.entries(ACTION_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>От даты</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#fff', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>До даты</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#fff', outline: 'none' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 42 }}>
              <Filter size={16} /> Применить
            </button>
          </div>
        </form>
      </div>

      {/* Results Table */}
      <div style={{ 
        background: 'var(--bg-surface)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius)', 
        overflow: 'hidden' 
      }}>
        {loading ? (
          <div style={{ padding: 100, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            Загрузка истории...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 100, textAlign: 'center', color: 'var(--text-muted)' }}>
            <History size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            Ничего не найдено по вашим критериям
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Дата и время</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Пользователь</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Раздел</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Действие</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Детали</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const entity = ENTITY_MAP[log.entity_type] || { label: log.entity_type, icon: Activity, color: '#64748b' }
                  const action = ACTION_MAP[log.action_type] || { label: log.action_type, color: '#64748b' }
                  const EntityIcon = entity.icon
                  
                  return (
                    <tr key={log.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ color: '#fff', fontSize: 14 }}>
                          {new Date(log.created_at).toLocaleString('ru-RU', { 
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                            {log.user_name.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ color: '#fff', fontWeight: 600 }}>{log.user_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: entity.color }}>
                          <EntityIcon size={14} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{entity.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: 4, 
                          fontSize: 10, 
                          fontWeight: 800, 
                          background: `${action.color}22`, 
                          color: action.color,
                          border: `1px solid ${action.color}44`
                        }}>
                          {action.label}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, maxWidth: 400, lineHeight: 1.4 }}>
                          {log.details}
                        </div>
                        {log.entity_id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                            <Tag size={10} /> ID: {log.entity_id}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div style={{ 
              padding: '16px 20px', 
              background: 'rgba(255,255,255,0.02)', 
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Показано {logs.length} записей
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: page === 0 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: page === 0 ? 'default' : 'pointer' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, color: '#fff', fontWeight: 600 }}>
                  Страница {page + 1}
                </div>
                <button 
                  disabled={logs.length < limit}
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: logs.length < limit ? 'rgba(255,255,255,0.2)' : '#fff', cursor: logs.length < limit ? 'default' : 'pointer' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AppLayout>
  )
}
