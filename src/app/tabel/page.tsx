'use client'
import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
import './tabel.css'
import { Send, ChevronLeft, ChevronRight, Wifi, WifiOff, Check, Users } from 'lucide-react'
import { getBrigadeWorkersWithEntries, saveTimeEntry, getWorkerHistory, WorkerWithEntry } from '@/actions/tabel'
import { getBrigades, getObjects } from '@/actions/common'
import { useAuth } from '@/components/AuthProvider'

// ── Логика дат ─────────────────────────────────────────────
function formatDate(d: Date) {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calcHours(start: string, end: string, lunch: number): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const totalMin = (eh * 60 + em) - (sh * 60 + sm) - lunch
  return Math.max(0, Math.round(totalMin / 6) / 10)
}

// ── Component ─────────────────────────────────────────────
export default function TabelPage() {
  const { user } = useAuth()
  const CURRENT_USER_ID = user?.id || ''

  const [activeBrigadeId, setActiveBrigadeId] = useState(user?.brigade_id || 'b3')
  const [object, setObject]     = useState('')
  const [startTime, setStart]   = useState('08:00')
  const [endTime, setEnd]       = useState('17:00')
  const [lunchMin, setLunch]    = useState(30)
  const [submitted, setSubmitted] = useState(false)
  
  const [toast, setToast]       = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [dateOffset, setDateOffset] = useState(0)

  const [showHistory, setShowHistory] = useState(false)

  // DB Data
  const [brigades, setBrigades] = useState<{id: string, name: string}[]>([])
  const [objects, setObjects] = useState<string[]>([])
  const [myBrigadeWorkers, setMyBrigadeWorkers] = useState<WorkerWithEntry[]>([])
  const [history, setHistory] = useState<{date: string, object: string, hours: number}[]>([])

  // Load initial lookups
  useEffect(() => {
    getBrigades().then(setBrigades)
    getObjects().then(setObjects)
  }, [])

  // Load Brigade entries when date or brigade changes
  useEffect(() => {
    if (!activeBrigadeId) return
    const d = new Date()
    d.setDate(d.getDate() + dateOffset)
    const dateStr = formatDate(d)
    
    getBrigadeWorkersWithEntries(activeBrigadeId, dateStr).then(workers => {
      setMyBrigadeWorkers(workers)
      
      // Auto-fill form for current user if viewing today
      if (dateOffset === 0) {
        const me = workers.find(w => w.id === CURRENT_USER_ID)
        if (me && me.hoursTotal > 0) {
          setObject(me.object)
          setStart(me.startTime)
          setEnd(me.endTime)
          setLunch(me.lunchMin)
          setSubmitted(true)
        } else {
          setObject('')
          setStart('08:00')
          setEnd('17:00')
          setLunch(30)
          setSubmitted(false)
        }
      }
    })
  }, [activeBrigadeId, dateOffset])

  // Offline detection
  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const hours = calcHours(startTime, endTime, lunchMin)

  const displayDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + dateOffset)
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const handleSubmit = useCallback(async () => {
    if (!object || !startTime || !endTime) return
    
    const d = new Date()
    d.setDate(d.getDate() + dateOffset)
    const dateStr = formatDate(d)

    await saveTimeEntry({
      workerId: CURRENT_USER_ID,
      brigadeId: activeBrigadeId,
      date: dateStr,
      object,
      startTime,
      endTime,
      lunchMin,
      hoursTotal: hours
    })

    setSubmitted(true)
    setToast(true)
    setTimeout(() => setToast(false), 3000)

    // Reload brigade workers to reflect changes
    const workers = await getBrigadeWorkersWithEntries(activeBrigadeId, dateStr)
    setMyBrigadeWorkers(workers)

  }, [object, startTime, endTime, lunchMin, hours, activeBrigadeId, dateOffset])

  const handleOpenHistory = async () => {
    const hist = await getWorkerHistory(CURRENT_USER_ID)
    setHistory(hist)
    setShowHistory(true)
  }

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Учёт времени</h1>
        {!isOnline && (
          <span className="offline-badge">
            <WifiOff size={12} /> Офлайн — сохраняется локально
          </span>
        )}
      </div>

      <div className="tabel-grid">
        {/* ── LEFT: Time Form ── */}
        <div className="time-form-card">
          <div className="time-form-body">
            <div style={{display:'flex', gap:12, marginBottom:16}}>
              {/* Object */}
              <div className="form-group" style={{flex:1, marginBottom:0}}>
                <label className="form-label">Объект</label>
                <input
                  list="objects-list"
                  className="form-input"
                  value={object}
                  onChange={e => setObject(e.target.value)}
                  disabled={submitted}
                  placeholder="Выберите объект..."
                  style={{ borderColor: !object && !submitted ? 'var(--accent)' : undefined }}
                />
                <datalist id="objects-list">
                  {objects.map(o => <option key={o} value={o}/>)}
                </datalist>
              </div>

              {/* Brigade */}
              <div className="form-group" style={{width: 140, flexShrink: 0, marginBottom:0}}>
                <label className="form-label">Бригада</label>
                <input 
                  list="brigades-list"
                  className="form-input"
                  value={activeBrigadeId} 
                  onChange={(e) => {
                    const b = brigades.find(bx => bx.name === e.target.value || bx.id === e.target.value);
                    if (b) setActiveBrigadeId(b.id);
                    else setActiveBrigadeId(e.target.value);
                  }}
                  style={{ padding: '10px 8px', fontSize: 13 }}
                  disabled={!!user?.brigade_id && user.role !== 'Админ'}
                  placeholder="Бригада..."
                />
                <datalist id="brigades-list">
                  {brigades.map(b => <option key={b.id} value={b.name}/>)}
                </datalist>
                {!!user?.brigade_id && user.role !== 'Админ' && (
                  <div style={{fontSize:9, color:'var(--green)', marginTop:2, fontWeight:700}}>ФИКСИРОВАНО</div>
                )}
              </div>
            </div>

            {/* Times */}
            <div className="time-row">
              <div className="form-group">
                <label className="form-label">Начало</label>
                <input
                  type="time"
                  className="form-input"
                  value={startTime}
                  onChange={e => setStart(e.target.value)}
                  disabled={submitted}
                  onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Конец</label>
                <input
                  type="time"
                  className="form-input"
                  value={endTime}
                  onChange={e => setEnd(e.target.value)}
                  disabled={submitted}
                  onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                />
              </div>
            </div>

            {/* Lunch */}
            <div className="form-group">
              <label className="form-label">Обед (мин)</label>
              <input
                type="number"
                className="form-input"
                value={lunchMin}
                onChange={e => setLunch(Number(e.target.value))}
                min={0}
                max={120}
                step={15}
                disabled={submitted}
              />
            </div>

            {/* Calculated hours */}
            <div className="calculated-hours">
              <span className="calculated-hours-label">Итого часов</span>
              <span className="calculated-hours-value">{hours > 0 ? `${hours} ч` : '—'}</span>
            </div>

            {/* Submit */}
            {!submitted ? (
              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={!object || !startTime || !endTime || hours === 0}
              >
                <Send size={15} />
                Отправить отчёт {hours > 0 ? `(${hours} ч)` : ''}
              </button>
            ) : (
              <button
                className="submit-btn"
                onClick={() => setSubmitted(false)}
                style={{ background: 'var(--green)' }}
              >
                <Check size={15} />
                Сдано · Изменить запись
              </button>
            )}

            {/* Last report */}
            {submitted && (
              <div className="last-report">
                <strong>Последний отчёт: {object} — {hours} ч</strong>
                <br />
                <button onClick={handleOpenHistory} className="history-link" style={{background:'none', border:'none', cursor:'pointer', fontFamily:'inherit'}}>≡ Ваша история и календарь</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Brigade List ── */}
        <div className="brigade-card">
          <div className="brigade-header">
            <div>
              <h2>Состав бригады на этот день</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {/* Date nav */}
              <div className="date-nav">
                <button className="date-nav-btn" onClick={() => setDateOffset(d => d - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span className="date-current">{dateOffset === 0 ? 'Сегодня' : displayDate()}</span>
                <button
                  className="date-nav-btn"
                  onClick={() => setDateOffset(d => d + 1)}
                  disabled={dateOffset >= 0}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Members */}
          {myBrigadeWorkers.map(member => (
              <div className="member-row" key={member.id} style={{ 
                borderLeft: member.hoursTotal > 0 ? '3px solid var(--green)' : '3px solid transparent'
              }}>
                <div
                  className="member-avatar"
                  style={{ background: member.userColor + '22', color: member.userColor, border: `1px solid ${member.userColor}44` }}
                >
                  {member.initials}
                </div>

                <div className="member-info">
                  <div className="member-name">{member.userName} {member.id === CURRENT_USER_ID ? '(Вы)' : ''}</div>
                  <div className="member-role">{member.userRole}{member.object ? ` · ${member.object}` : ''}</div>
                </div>

                <div className="member-times">
                  {member.startTime ? (
                    <>
                      <div className="member-time-value">{member.startTime}{member.endTime ? ` — ${member.endTime}` : ' — ...'}</div>
                      <div className="member-time-label">обед {member.lunchMin} мин</div>
                    </>
                  ) : (
                    <div className="member-time-value" style={{ color: 'var(--text-muted)' }}>—</div>
                  )}
                </div>

                <div className="member-hours">
                  {member.hoursTotal > 0 ? (
                    <>
                      <div className="member-hours-value">{member.hoursTotal}</div>
                      <div className="member-hours-label">ч</div>
                    </>
                  ) : (
                    <div className="member-hours-value" style={{ color: 'var(--text-muted)', fontSize: 14 }}>—</div>
                  )}
                </div>

              </div>
            )
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:24,width:'100%',maxWidth:400}}>
            <h3 style={{color:'#fff',marginBottom:16}}>Ваша история</h3>
            
            <div style={{maxHeight:'300px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:8, marginBottom:16}}>
              {history.length > 0 ? history.map((h, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'12px', borderBottom:'1px solid var(--border)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.02)'}}>
                  <div style={{color:'var(--text-muted)', fontSize:13}}>{h.date}</div>
                  <div style={{color:'#fff', fontWeight:600, fontSize:13}}>{h.object}</div>
                  <div style={{color:'var(--accent)', fontWeight:800}}>{h.hours} ч</div>
                </div>
              )) : (
                <div style={{padding: 20, textAlign: 'center', color: 'var(--text-muted)'}}>Нет записанных смен</div>
              )}
            </div>

            <button onClick={() => setShowHistory(false)} style={{width:'100%',padding:'12px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-muted)',fontWeight:600}}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast">
          <Check size={16} />
          Отчёт отправлен — {hours} ч · {object}
        </div>
      )}
    </AppLayout>
  )
}
