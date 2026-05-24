'use client'
import { useState, useEffect } from 'react'
import { AuditLog } from '@/actions/history'
import { History, Clock, User, Tag, Activity } from 'lucide-react'

interface Props {
  logs: AuditLog[]
}

const ACTION_COLORS: Record<string, string> = {
  create: '#22c55e',
  update: '#3b82f6',
  delete: '#ef4444',
  transfer: '#f59e0b',
  repair: '#8b5cf6',
  writeoff: '#ef4444',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  transfer: 'Передача',
  repair: 'Ремонт',
  writeoff: 'Списание',
}

const ENTITY_LABELS: Record<string, string> = {
  tool: 'Инструмент',
  siz: 'СИЗ',
  worker: 'Сотрудник',
  object: 'Объект',
  brigade: 'Бригада',
  supply: 'Снабжение',
  salary: 'Зарплата',
  finance: 'Финансы'
}

export function HistoryFeed({ logs }: Props) {
  const [collapseMode, setCollapseMode] = useState<'collapsed' | 'partial' | 'full'>('full')

  useEffect(() => {
    const saved = localStorage.getItem('merkare_history_feed_mode')
    if (saved === 'collapsed' || saved === 'partial' || saved === 'full') {
      setCollapseMode(saved)
    }
  }, [])

  const handleModeChange = (mode: 'collapsed' | 'partial' | 'full') => {
    setCollapseMode(mode)
    localStorage.setItem('merkare_history_feed_mode', mode)
  }

  const visibleLogs = collapseMode === 'collapsed'
    ? []
    : (collapseMode === 'partial' ? logs.slice(0, 3) : logs)

  return (
    <div style={{
      marginTop: 40,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 20,
      marginBottom: 40
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapseMode === 'collapsed' ? 0 : 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={20} color="var(--accent)" />
          <h2 style={{ fontSize: 18, color: '#fff', margin: 0 }}>История действий (Аудит)</h2>
        </div>

        {/* Segmented Control */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--bg-elevated)',
          padding: 2,
          borderRadius: 8,
          border: '1px solid var(--border-light)'
        }}>
          {(['collapsed', 'partial', 'full'] as const).map((mode) => {
            const isActive = collapseMode === mode
            const labels = {
              collapsed: 'Свернуть',
              partial: '3 записи',
              full: 'Все'
            }
            return (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                {labels[mode]}
              </button>
            )
          })}
        </div>
      </div>

      {collapseMode !== 'collapsed' && (
        !logs.length ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            Здесь будут отображаться все изменения: удаления, добавления и правки. Пока действий не зафиксировано.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleLogs.map((log) => (
            <div key={log.id} style={{
              display: 'flex',
              gap: 15,
              padding: '12px 15px',
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              borderLeft: `4px solid ${ACTION_COLORS[log.action_type] || '#ccc'}`
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      color: ACTION_COLORS[log.action_type],
                      background: `${ACTION_COLORS[log.action_type]}15`,
                      padding: '2px 6px',
                      borderRadius: 4
                    }}>
                      {ACTION_LABELS[log.action_type] || log.action_type}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {new Date(log.created_at).toLocaleString('ru-RU')}
                  </span>
                </div>
                
                <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.4, marginBottom: 6 }}>
                  {log.details}
                </div>

                <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                    <User size={12} /> {log.user_name}
                  </div>
                  {log.entity_id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                      <Tag size={12} /> ID: {log.entity_id}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        )
      )}
    </div>
  )
}
