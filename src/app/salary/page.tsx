'use client'
import { useState, useMemo, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import {
  Banknote, Search, Check, ChevronLeft, ChevronRight,
  TrendingDown, TrendingUp, HandCoins, CheckCircle2,
  Users, Briefcase, FileSignature, Landmark, Trash2
} from 'lucide-react'

import { 
  getSalaryData, updateBrigadePot, updateWorkerRate, addFinanceRecord, resetFinanceRecord, 
  BrigadeSalaryData, WorkerSalaryData, getMonthlyTimesheet,
  getObjects, updateTimeEntry, deleteTimeEntry, createTimeEntry 
} from '@/actions/salary'
import { exportSalaryToTemplate } from '@/actions/export'
import { FileDown, Calendar, Table as TableIcon, List } from 'lucide-react'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function formatMoney(amount: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)
}

function calcHours(start: string, end: string, lunch: number): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const totalMin = (eh * 60 + em) - (sh * 60 + sm) - lunch
  return Math.max(0, Math.round((totalMin / 60) * 100) / 100)
}

function decimalToHm(decimalHours: number): string {
  if (!decimalHours || decimalHours <= 0) return '0'
  const hours = Math.floor(decimalHours)
  const minutes = Math.round((decimalHours - hours) * 60)
  if (minutes === 0) return `${hours}`
  return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`
}

function decimalToHmLabel(decimalHours: number): string {
  if (!decimalHours || decimalHours <= 0) return '0 ч'
  const hours = Math.floor(decimalHours)
  const minutes = Math.round((decimalHours - hours) * 60)
  if (minutes === 0) return `${hours} ч`
  return `${hours} ч ${minutes} мин`
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function SalaryPage() {
  const [brigades, setBrigades] = useState<BrigadeSalaryData[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [viewMode, setViewMode] = useState<'list' | 'timesheet'>('timesheet')
  const [timesheetData, setTimesheetData] = useState<any>(null)
  
  // Modals / Inputs
  const [advModal, setAdvModal] = useState<{wid:string}|null>(null)
  const [adjModal, setAdjModal] = useState<{wid:string, type:'bonus'|'penalty'}|null>(null)
  const [numInput, setNumInput] = useState('')
  const [editTimeModal, setEditTimeModal] = useState<{
    entry: any,
    workerName: string,
    date: string
  } | null>(null)
  const [allObjects, setAllObjects] = useState<{id:string, name:string}[]>([])
  const [toast, setToast] = useState('')

  useEffect(() => {
    getObjects().then(setAllObjects)
  }, [])

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000) }

  // ── SERVER DATA SYNC ──
  const loadData = async () => {
    const data = await getSalaryData(monthIdx, year)
    setBrigades(data)
    if (!activeTab && data.length > 0) {
      setActiveTab(data[0].id)
    }
  }

  useEffect(() => {
    loadData()
  }, [monthIdx, year, activeTab])

  useEffect(() => {
    if (viewMode === 'timesheet' && activeTab) {
      getMonthlyTimesheet(monthIdx, year, activeTab).then(setTimesheetData)
    }
  }, [monthIdx, year, activeTab, viewMode])

  // ── ACTIONS ──
  const handlePrevMonth = () => { if(monthIdx===0){setMonthIdx(11);setYear(y=>y-1)} else setMonthIdx(m=>m-1) }
  const handleNextMonth = () => { if(monthIdx===11){setMonthIdx(0);setYear(y=>y+1)} else setMonthIdx(m=>m+1) }

  const bIdx = brigades.findIndex(b=>b.id===activeTab)
  const activeB = brigades[bIdx]

  // Смена значения (Общий котел) - Local State
  const changePot = (val: string) => {
    if(!activeB) return
    if(val === '') {
      const nb = [...brigades]
      nb[bIdx] = { ...nb[bIdx], potAmount: 0 }
      setBrigades(nb)
      return
    }
    const clean = val.replace(/[^0-9]/g, '')
    if(clean === '') return
    const num = parseInt(clean, 10)
    const nb = [...brigades]
    nb[bIdx] = { ...nb[bIdx], potAmount: num }
    setBrigades(nb)
  }
  // Save to DB
  const savePot = async () => {
    if(!activeB) return
    await updateBrigadePot(activeB.id, monthIdx, year, activeB.potAmount)
  }

  // Обновление базовой ставки - Local State
  const changeBaseRate = (wid: string, val: string) => {
    if(val === '') {
      const nb = [...brigades]
      nb[bIdx] = {
        ...nb[bIdx],
        workers: nb[bIdx].workers.map(w => w.id === wid ? {...w, baseRate: 0} : w)
      }
      setBrigades(nb)
      return
    }
    const clean = val.replace(/[^0-9]/g, '')
    if(clean === '') return
    const num = parseInt(clean, 10)
    const nb = [...brigades]
    nb[bIdx] = {
      ...nb[bIdx],
      workers: nb[bIdx].workers.map(w => w.id === wid ? {...w, baseRate: num} : w)
    }
    setBrigades(nb)
  }
  // Save to DB
  const saveBaseRate = async (wid: string) => {
    const worker = activeB?.workers.find(w => w.id === wid)
    if(worker) await updateWorkerRate(wid, worker.baseRate)
  }

  const applyAdvance = async () => {
    if(!advModal || !numInput) return
    const val = parseInt(numInput.replace(/[^0-9]/g, ''))
    if(val>0) {
      await addFinanceRecord(advModal.wid, 'advance', val, monthIdx, year)
      await loadData() // reload fully to calculate everything safely
      showToast(`Списан аванс: ${formatMoney(val)}`)
    }
    setAdvModal(null); setNumInput('')
  }

  const applyAdj = async () => {
    if(!adjModal || !numInput) return
    const val = parseInt(numInput.replace(/[^0-9]/g, ''))
    if(val>0) {
      await addFinanceRecord(adjModal.wid, adjModal.type, val, monthIdx, year)
      await loadData()
      showToast(adjModal.type==='bonus' ? `Премия начислена` : `Штраф удержан`)
    }
    setAdjModal(null); setNumInput('')
  }

  const resetAdvance = async () => {
    if(!advModal) return
    await resetFinanceRecord(advModal.wid, 'advance', monthIdx, year)
    await loadData()
    showToast(`Авансы сброшены`)
    setAdvModal(null); setNumInput('')
  }

  const resetAdj = async () => {
    if(!adjModal) return
    await resetFinanceRecord(adjModal.wid, adjModal.type, monthIdx, year)
    await loadData()
    showToast(`${adjModal.type==='bonus'?'Премия':'Штраф'} аннулирована`)
    setAdjModal(null); setNumInput('')
  }

  const payWorker = (wid: string) => {
    // Fake payment, ideally we add logic to mark as paid in DB
    const nb = [...brigades]
    nb[bIdx].workers = nb[bIdx].workers.map(w => w.id === wid ? {...w, status: 'paid'} : w)
    setBrigades(nb)
    showToast('Статус: выплачено')
  }

  const handleExportTemplate = () => {
    // Используем скрытую ссылку для максимальной совместимости с Chrome
    const link = document.createElement('a')
    link.href = `/api/export/salary?month=${monthIdx}&year=${year}&brigadeId=${activeTab}`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Запрос на экспорт отправлен')
  }

  // ─────────────────────────────────────────────
  //  Math (Котловой КТУ)
  // ─────────────────────────────────────────────
  const math = useMemo(() => {
    if(!activeB) return { items: [], top:{toPay:0, advances:0, firmPenalties:0, remainingPot:0} }
    
    let sumBase = 0
    let totalBonuses = 0

    const items = activeB.workers.map(w => {
      const basePay = w.hours * w.baseRate
      const gross = basePay + w.bonuses
      const finalPay = gross - w.penalties - w.advances

      sumBase += basePay
      totalBonuses += w.bonuses

      return { w, basePay, gross, finalPay }
    })

    const remainingPot = activeB.potAmount > 0 ? (activeB.potAmount - sumBase - totalBonuses) : 0

    let toPay=0, advances=0, firmPenalties=0
    items.forEach(i=>{
      if(i.w.status!=='paid') toPay += Math.max(0, i.finalPay)
      advances += i.w.advances
      firmPenalties += i.w.penalties
    })

    return { items, top: { toPay, advances, firmPenalties, remainingPot } }
  }, [activeB])

  if (!activeB && brigades.length > 0) return null
  if (brigades.length === 0) return <AppLayout><div style={{padding:20, color:'#fff'}}>Загрузка базы данных Зарплат...</div></AppLayout>

  return (
    <AppLayout>
      {/* ── Page Header ── */}
      <div className="page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h1 style={{color:'#fff',display:'flex',alignItems:'center',gap:10}}><Briefcase size={22} color="var(--blue)"/> Расчёт Бригад (Сделка / КТУ)</h1>
        
        {/* Month Selector */}
        <div style={{display:'flex',alignItems:'center',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:20,padding:'4px'}}>
          <button onClick={handlePrevMonth} style={{padding:6,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer',border:'none',background:'transparent'}}><ChevronLeft size={16}/></button>
          <div style={{fontWeight:700,fontSize:13,width:110,textAlign:'center',color:'#fff'}}>{MONTHS[monthIdx]} {year}</div>
          <button onClick={handleNextMonth} style={{padding:6,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer',border:'none',background:'transparent'}}><ChevronRight size={16}/></button>
        </div>

        <div style={{display:'flex', gap:8}}>
          <div style={{display:'flex', background:'var(--bg-elevated)', borderRadius:20, padding:2, border:'1px solid var(--border)'}}>
            <button 
              onClick={() => setViewMode('list')}
              style={{
                display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:18, border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                background: viewMode === 'list' ? 'var(--blue)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <List size={14}/> Список
            </button>
            <button 
              onClick={() => setViewMode('timesheet')}
              style={{
                display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:18, border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                background: viewMode === 'timesheet' ? 'var(--blue)' : 'transparent',
                color: viewMode === 'timesheet' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <TableIcon size={14}/> Табель
            </button>
          </div>

          <button 
            onClick={handleExportTemplate}
            style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background:'var(--bg-surface)', color:'#fff', 
              border:'1px solid var(--border)', borderRadius:20, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <FileDown size={16}/> Шаблон
          </button>
        </div>
      </div>

      <div className="responsive-flex-col" style={{ width: '100%' }}>
        
        {/* ── LEFT: Brigade List ── */}
        <div style={{width: '100%', maxWidth: '260px', flexShrink:0, display:'flex', flexDirection:'column', gap:8}}>
          <div style={{fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:4, paddingLeft:8}}>Списки бригад</div>
          {brigades.map(b=>(
            <button key={b.id} onClick={()=>setActiveTab(b.id)}
              style={{
                textAlign:'left', padding:'12px 14px', borderRadius:'var(--radius-sm)', cursor:'pointer', transition:'all 0.2s',
                background: activeTab===b.id ? 'var(--blue)' : 'var(--bg-surface)',
                border: `1px solid ${activeTab===b.id ? 'var(--blue)' : 'var(--border)'}`,
                color: activeTab===b.id ? '#fff' : 'var(--text-primary)',
                boxShadow: activeTab===b.id ? '0 4px 12px rgba(59,130,246,0.3)' : 'none'
              }}>
              <div style={{fontWeight:800, fontSize:14}}>{b.name}</div>
              <div style={{fontSize:12, marginTop:4, opacity:activeTab===b.id ? 0.9 : 0.5}}>Людей: {b.workers.length} {b.potAmount>0 && `| ${formatMoney(b.potAmount)}`}</div>
            </button>
          ))}
        </div>

        {/* ── RIGHT: Pot & Table ── */}
        <div style={{flex:1, width: '100%' }}>
          
          {viewMode === 'list' ? (
            <>
              {/* Pot Setup */}
              <div style={{background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:20, marginBottom:16}}>
                <div className="responsive-flex-col" style={{justifyContent:'space-between', gap: 16}}>
                  <div>
                    <h2 style={{fontSize:20, fontWeight:900, color:'#fff', marginBottom:4}}>{activeB.name}</h2>
                    <div style={{fontSize:13, color:'var(--text-muted)'}}>
                      Сдельное распределение по коэффициенту трудового участия (КТУ).
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6}}>Общая сумма за объект (Котел)</div>
                    <input 
                      type="text" 
                      value={activeB.potAmount===0 ? '' : activeB.potAmount.toLocaleString('ru-RU')}
                      onChange={e=>changePot(e.target.value)}
                      onBlur={savePot}
                      placeholder="Окладный режим (0 ₽)"
                      style={{
                        background:'var(--bg-elevated)', border:'1px solid var(--border-light)', borderRadius:8, 
                        padding:'10px 16px', fontSize:22, fontWeight:900, color:'#fff', outline:'none',
                        width: '100%', maxWidth: '250px', borderBottom:`2px solid ${activeB.potAmount>0 ? 'var(--blue)' : 'var(--border-light)'}`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Money Flow Dashboard */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
                {activeB.potAmount > 0 && (
                  <div style={{background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:'var(--radius)', padding:'14px 18px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--blue)', fontSize:11, fontWeight:800, textTransform:'uppercase', marginBottom:4}}><Briefcase size={14}/> Остаток котла</div>
                    <div style={{fontSize:24, fontWeight:900, color:'#fff'}}>{formatMoney(math.top.remainingPot)}</div>
                    <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>Фонд для премий</div>
                  </div>
                )}

                <div style={{background:'var(--green-dim)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'var(--radius)', padding:'14px 18px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--green)', fontSize:11, fontWeight:800, textTransform:'uppercase', marginBottom:4}}><Banknote size={14}/> На руки бригаде</div>
                  <div style={{fontSize:24, fontWeight:900, color:'#fff'}}>{formatMoney(math.top.toPay)}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>Сумма к физической выдаче</div>
                </div>
                
                <div style={{background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:'var(--radius)', padding:'14px 18px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--yellow)', fontSize:11, fontWeight:800, textTransform:'uppercase', marginBottom:4}}><HandCoins size={14}/> Возврат за авансы</div>
                  <div style={{fontSize:24, fontWeight:900, color:'#fff'}}>{formatMoney(math.top.advances)}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>Отдать спонсору / прорабу</div>
                </div>

                <div style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--radius)', padding:'14px 18px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--red)', fontSize:11, fontWeight:800, textTransform:'uppercase', marginBottom:4}}><Landmark size={14}/> В кассу фирмы</div>
                  <div style={{fontSize:24, fontWeight:900, color:'#fff'}}>{formatMoney(math.top.firmPenalties)}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>Удержанные штрафы</div>
                </div>
              </div>

              {/* Table */}
              <div style={{background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'var(--bg-elevated)'}}>
                      <th style={{padding:'12px 14px', textAlign:'left', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}}>Сотрудник</th>
                      <th style={{padding:'12px 14px', textAlign:'center', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}}>Часы (БД)</th>
                      <th style={{padding:'12px 14px', textAlign:'center', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}} title="Коэффициент ценности">Ставка / Вес</th>
                      <th style={{padding:'12px 14px', textAlign:'right', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}}>Доля / Премия</th>
                      <th style={{padding:'12px 14px', textAlign:'right', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}}>Авансы / Штрафы</th>
                      <th style={{padding:'12px 14px', textAlign:'right', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}}>Итог На Руки</th>
                      <th style={{padding:'12px 14px', textAlign:'right', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}}>Управление</th>
                    </tr>
                  </thead>
                  <tbody>
                    {math.items.map(({ w, basePay, gross, finalPay }) => {
                      const isPaid = w.status === 'paid'
                      return (
                        <tr key={w.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)', background:isPaid?'rgba(255,255,255,0.02)':'transparent'}}>
                          <td style={{padding:'12px 14px'}}>
                            <div style={{fontWeight:700, color:'#fff', fontSize:14}}>{`${w.last_name || ''} ${w.first_name || ''} ${w.patronymic || ''}`.trim() || w.name}</div>
                            <div style={{fontSize:11, color:'var(--text-muted)'}}>{w.role}</div>
                          </td>
                          
                          {/* ЧАСЫ (Реальные из БД) */}
                          <td style={{padding:'12px 14px', textAlign:'center'}}>
                            <div style={{width:80, textAlign:'center', display:'inline-block', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'6px', color: w.hours > 0 ? '#fff' : 'var(--text-muted)', outline:'none'}} title={decimalToHmLabel(w.hours)}>
                              {decimalToHm(w.hours)}
                            </div>
                          </td>

                          {/* СТАВКА */}
                          <td style={{padding:'12px 14px', textAlign:'center'}}>
                            <input type="text" placeholder="0" value={w.baseRate === 0 ? '' : w.baseRate} 
                              onChange={e=>changeBaseRate(w.id, e.target.value)}
                              onBlur={()=>saveBaseRate(w.id)}
                              style={{width:80, textAlign:'center', background:'var(--bg-elevated)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'10px 8px', fontSize:14, fontWeight:700, color:'#fff', outline:'none', transition:'border 0.2s', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.1)'}}/>
                          </td>

                          {/* ДОЛЯ И ПРЕМИИ */}
                          <td style={{padding:'12px 14px', textAlign:'right'}}>
                            <div style={{fontWeight:800, color:'#fff', fontSize:13}}>Оклад: {formatMoney(basePay)}</div>
                            {w.bonuses > 0 && <div style={{color:'var(--green)', fontSize:11, fontWeight:700, marginTop:4}}>+ {formatMoney(w.bonuses)} (Премия)</div>}
                          </td>

                          {/* УДЕРЖАНИЯ */}
                          <td style={{padding:'12px 14px', textAlign:'right'}}>
                            {w.advances > 0 && <div style={{color:'var(--yellow)', fontSize:12, fontWeight:700}}>- {formatMoney(w.advances)} <span style={{fontSize:10,fontWeight:400}}>(Аванс)</span></div>}
                            {w.penalties > 0 && <div style={{color:'var(--red)', fontSize:12, fontWeight:700, marginTop:2}}>- {formatMoney(w.penalties)} <span style={{fontSize:10,fontWeight:400}}>(Штраф)</span></div>}
                            {!w.advances && !w.penalties && <span style={{color:'var(--text-muted)'}}>—</span>}
                          </td>

                          {/* ИТОГ */}
                          <td style={{padding:'12px 14px', textAlign:'right'}}>
                            <div style={{
                              fontSize:18, fontWeight:900, 
                              color: isPaid ? 'var(--text-muted)' : finalPay>0 ? 'var(--green)' : '#fff',
                              textDecoration: isPaid ? 'line-through' : 'none'
                            }}>
                              {formatMoney(Math.max(0, finalPay))}
                            </div>
                            {isPaid && <div style={{fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', marginTop:2}}>Выплачено</div>}
                          </td>

                          {/* КНОПКИ */}
                          <td style={{padding:'12px 14px'}}>
                            <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
                              <div style={{display:'flex', flexDirection:'column', gap:4}}>
                                <div style={{display:'flex', gap:4}}>
                                  <button onClick={()=>setAdjModal({wid:w.id, type:'bonus'})} title="Премия (из котла)" style={{padding:'4px 6px',borderRadius:4,background:'var(--green-dim)',color:'var(--green)',border:'none',cursor:'pointer'}}><TrendingUp size={12}/></button>
                                  <button onClick={()=>setAdjModal({wid:w.id, type:'penalty'})} title="Штраф (В кассу)" style={{padding:'4px 6px',borderRadius:4,background:'var(--red-dim)',color:'var(--red)',border:'none',cursor:'pointer'}}><TrendingDown size={12}/></button>
                                </div>
                                <button onClick={()=>setAdvModal({wid:w.id})} style={{padding:'4px 8px',borderRadius:4,background:'var(--yellow-dim)',color:'var(--yellow)',border:'none',fontSize:10,fontWeight:700,cursor:'pointer'}}>АВАНС</button>
                              </div>
                              
                              {!isPaid && finalPay > 0 && (
                                <button onClick={()=>payWorker(w.id)} style={{padding:'0 12px',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',color:'#fff',borderRadius:6,fontWeight:700,fontSize:12,cursor:'pointer',height:46, transition:'0.2s'}}>
                                  ЗП
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* ── TIMESHEET GRID VIEW ── */
            <div style={{background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:0, overflow:'hidden', display:'flex', flexDirection:'column'}}>
              <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2 style={{fontSize:18, fontWeight:800, color:'#fff'}}>Сводный табель часов ({activeB.name})</h2>
                <div style={{fontSize:12, color:'var(--text-muted)'}}>Листайте вправо для просмотра всех дат →</div>
              </div>
              
              <div style={{overflowX:'auto', width:'100%'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:1200}}>
                  <thead>
                    <tr style={{background:'var(--bg-elevated)'}}>
                      <th style={{position:'sticky', left:0, zIndex:10, background:'var(--bg-elevated)', padding:'12px 14px', textAlign:'left', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'2px solid var(--border)', width:200}}>Сотрудник</th>
                      {[...Array(new Date(year, monthIdx + 1, 0).getDate())].map((_, i) => (
                        <th key={i} style={{padding:'10px 4px', textAlign:'center', fontSize:11, color:'var(--text-muted)', borderBottom:'2px solid var(--border)', width:35, borderLeft:'1px solid rgba(255,255,255,0.05)'}}>
                          {i + 1}
                        </th>
                      ))}
                      <th style={{padding:'12px 14px', textAlign:'center', fontSize:11, color:'var(--blue)', fontWeight:800, textTransform:'uppercase', borderBottom:'2px solid var(--border)', width:70}}>Итого</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheetData && timesheetData.map((item: any) => {
                      const rawTotal = Object.values(item.days).reduce((acc: number, day: any) => acc + day.hours, 0)
                      const total = Math.round(rawTotal * 100) / 100
                      return (
                        <tr key={item.worker.id} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                          <td style={{position:'sticky', left:0, zIndex:10, background:'var(--bg-surface)', padding:'12px 14px', borderRight:'2px solid var(--border)'}}>
                            <div style={{fontWeight:700, color:'#fff', fontSize:13}}>{item.worker.last_name} {item.worker.first_name[0]}.</div>
                            <div style={{fontSize:10, color:'var(--text-muted)'}}>{item.worker.role}</div>
                          </td>
                          {[...Array(new Date(year, monthIdx + 1, 0).getDate())].map((_, i) => {
                            const day = i + 1
                            const dayData = item.days[day]
                            
                            const dayStr = day < 10 ? `0${day}` : `${day}`
                            const monthStr = (monthIdx + 1) < 10 ? `0${monthIdx + 1}` : `${monthIdx + 1}`
                            const dateStr = `${dayStr}.${monthStr}.${year}`

                            return (
                              <td key={i} 
                                onClick={() => {
                                  if (dayData && dayData.entries && dayData.entries.length > 0) {
                                    setEditTimeModal({
                                      entry: { ...dayData.entries[0] },
                                      workerName: `${item.worker.last_name} ${item.worker.first_name}`,
                                      date: dayData.entries[0].date
                                    })
                                  } else {
                                    // Создаем новую запись для добавления времени
                                    setEditTimeModal({
                                      entry: {
                                        worker_id: item.worker.id.toString(),
                                        brigade_id: activeTab,
                                        object_id: '',
                                        date: dateStr,
                                        start_time: '08:00',
                                        end_time: '17:00',
                                        lunch_min: 60,
                                        hours_total: 8
                                      },
                                      workerName: `${item.worker.last_name} ${item.worker.first_name}`,
                                      date: dateStr
                                    })
                                  }
                                }}
                                title={dayData?.object ? dayData.object : 'Нажмите, чтобы внести рабочее время'} 
                                style={{
                                  padding:'10px 4px', 
                                  textAlign:'center', 
                                  borderLeft:'1px solid rgba(255,255,255,0.05)', 
                                  background: dayData ? 'rgba(59,130,246,0.05)' : 'transparent',
                                  cursor: 'pointer'
                                }}>
                                {dayData ? (
                                  <div style={{fontWeight:800, color: dayData.hours >= 10 ? 'var(--orange)' : 'var(--blue)', fontSize:13}}>
                                    {decimalToHm(dayData.hours)}
                                  </div>
                                ) : (
                                  <span style={{color:'rgba(255,255,255,0.1)'}}>·</span>
                                )}
                              </td>
                            )
                          })}
                          <td style={{padding:'12px 14px', textAlign:'center', background:'rgba(59,130,246,0.1)', fontWeight:900, color:'#fff', fontSize:14}}>
                            {decimalToHm(total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODALS (Reusable logic from previous setup, shortened for brevity) ── */}
      {/* АВАНС */}
      {advModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:24,width:'100%',maxWidth:360}}>
            <h3 style={{color:'var(--yellow)',marginBottom:8,display:'flex',alignItems:'center',gap:8}}><HandCoins size={18}/> Выдать аванс</h3>
            <input type="text" placeholder="Сумма" value={numInput} onChange={e=>setNumInput(e.target.value.replace(/[^0-9]/g, ''))} autoFocus style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'12px',fontSize:18,color:'#fff',marginBottom:16,outline:'none'}} />
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setAdvModal(null); setNumInput('')}} style={{flex:1,padding:'12px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-muted)',fontWeight:600}}>Отмена</button>
              <button onClick={resetAdvance} title="Сбросить все авансы" style={{padding:'12px',background:'var(--red-dim)',border:'none',borderRadius:6,color:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={18}/></button>
              <button onClick={applyAdvance} disabled={!numInput} style={{flex:2,padding:'12px',background:'var(--yellow)',border:'none',borderRadius:6,color:'#000',fontWeight:800}}>Выдать</button>
            </div>
          </div>
        </div>
      )}

      {/* ШТРАФ/ПРЕМИЯ */}
      {adjModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:24,width:'100%',maxWidth:360}}>
            <h3 style={{color:adjModal.type==='bonus'?'var(--green)':'var(--red)',marginBottom:8}}>{adjModal.type==='bonus'?'Начислить премию':'Удержать штраф'}</h3>
            {adjModal.type==='bonus' && <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>Премия будет вычтена из общего котла бригады.</div>}
            {adjModal.type==='penalty' && <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>Штраф вычитается из доли сотрудника и уходит в кассу фирмы.</div>}
            <input type="text" placeholder="Сумма" value={numInput} onChange={e=>setNumInput(e.target.value.replace(/[^0-9]/g, ''))} autoFocus style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'12px',fontSize:18,color:'#fff',marginBottom:16,outline:'none'}} />
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setAdjModal(null); setNumInput('')}} style={{flex:1,padding:'12px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-muted)'}}>Отмена</button>
              <button onClick={resetAdj} title="Удалить запись" style={{padding:'12px',background:'var(--red-dim)',border:'none',borderRadius:6,color:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={18}/></button>
              <button onClick={applyAdj} disabled={!numInput} style={{flex:2,padding:'12px',background:adjModal.type==='bonus'?'var(--green)':'var(--red)',border:'none',borderRadius:6,color:'#fff',fontWeight:800}}>{adjModal.type==='bonus'?'Начислить':'Удержать'}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:24,right:24,background:'var(--bg-elevated)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius)',padding:'12px 18px',color:'#fff',fontSize:13,fontWeight:600,zIndex:500,boxShadow:'0 8px 32px rgba(0,0,0,0.4)',display:'flex',alignItems:'center',gap:8}}>
          <Check size={15} color="var(--green)"/> {toast}
        </div>
      )}
      {/* ── EDIT TIME MODAL ── */}
      {editTimeModal && (
        <div style={{position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)'}}>
          <div style={{background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:400, overflow:'hidden', boxShadow:'0 20px 50px rgba(0,0,0,0.5)'}}>
            <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(to right, var(--bg-elevated), transparent)'}}>
              <div>
                <h3 style={{fontSize:18, fontWeight:800, color:'#fff'}}>
                  {editTimeModal.entry.id ? 'Корректировка времени' : 'Добавление рабочего времени'}
                </h3>
                <div style={{fontSize:12, color:'var(--text-muted)'}}>{editTimeModal.workerName} • {editTimeModal.date}</div>
              </div>
              <button onClick={()=>setEditTimeModal(null)} style={{background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer'}}>✕</button>
            </div>
            
            <div style={{padding:24, display:'flex', flexDirection:'column', gap:16}}>
              <div>
                <label style={{display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6}}>Объект</label>
                <select 
                  value={editTimeModal.entry.object_id || ''} 
                  onChange={e => setEditTimeModal({...editTimeModal, entry: {...editTimeModal.entry, object_id: e.target.value}})}
                  style={{width:'100%', padding:12, borderRadius:10, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'#fff', outline:'none'}}
                >
                  <option value="">Выберите объект</option>
                  {allObjects.map(obj => <option key={obj.id} value={obj.id}>{obj.name}</option>)}
                </select>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6}}>Начало</label>
                  <input type="time" 
                    value={editTimeModal.entry.start_time || ''} 
                    onChange={e => {
                      const newStart = e.target.value
                      const newHours = calcHours(newStart, editTimeModal.entry.end_time || '', editTimeModal.entry.lunch_min || 0)
                      setEditTimeModal({
                        ...editTimeModal,
                        entry: {
                          ...editTimeModal.entry,
                          start_time: newStart,
                          hours_total: newHours
                        }
                      })
                    }}
                    style={{width:'100%', padding:12, borderRadius:10, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'#fff', outline:'none'}}
                  />
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6}}>Конец</label>
                  <input type="time" 
                    value={editTimeModal.entry.end_time || ''} 
                    onChange={e => {
                      const newEnd = e.target.value
                      const newHours = calcHours(editTimeModal.entry.start_time || '', newEnd, editTimeModal.entry.lunch_min || 0)
                      setEditTimeModal({
                        ...editTimeModal,
                        entry: {
                          ...editTimeModal.entry,
                          end_time: newEnd,
                          hours_total: newHours
                        }
                      })
                    }}
                    style={{width:'100%', padding:12, borderRadius:10, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'#fff', outline:'none'}}
                  />
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6}}>Обед (мин)</label>
                  <input type="number" 
                    value={editTimeModal.entry.lunch_min === undefined ? '' : editTimeModal.entry.lunch_min} 
                    onChange={e => {
                      const newLunch = parseInt(e.target.value) || 0
                      const newHours = calcHours(editTimeModal.entry.start_time || '', editTimeModal.entry.end_time || '', newLunch)
                      setEditTimeModal({
                        ...editTimeModal,
                        entry: {
                          ...editTimeModal.entry,
                          lunch_min: newLunch,
                          hours_total: newHours
                        }
                      })
                    }}
                    style={{width:'100%', padding:12, borderRadius:10, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'#fff', outline:'none'}}
                  />
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6}}>
                    Итого часов {editTimeModal.entry.hours_total ? `(${decimalToHmLabel(editTimeModal.entry.hours_total)})` : ''}
                  </label>
                  <input type="number" step="0.5"
                    value={editTimeModal.entry.hours_total === undefined ? '' : editTimeModal.entry.hours_total} 
                    onChange={e => setEditTimeModal({...editTimeModal, entry: {...editTimeModal.entry, hours_total: parseFloat(e.target.value)||0}})}
                    style={{width:'100%', padding:12, borderRadius:10, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'#fff', outline:'none'}}
                  />
                </div>
              </div>
            </div>

            <div style={{padding:24, background:'var(--bg-elevated)', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', gap:12}}>
              {editTimeModal.entry.id ? (
                <button 
                  onClick={async () => {
                    if (window.confirm('Удалить эту запись?')) {
                      await deleteTimeEntry(editTimeModal.entry.id)
                      setEditTimeModal(null)
                      getMonthlyTimesheet(monthIdx, year, activeTab).then(setTimesheetData)
                      loadData()
                    }
                  }}
                  style={{padding:'12px 16px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'var(--red)', fontWeight:700, cursor:'pointer'}}
                >
                  Удалить
                </button>
              ) : (
                <div />
              )}
              <div style={{display:'flex', gap:12}}>
                <button onClick={()=>setEditTimeModal(null)} style={{padding:'12px 16px', borderRadius:10, background:'none', border:'1px solid var(--border)', color:'#fff', fontWeight:700, cursor:'pointer'}}>Отмена</button>
                <button 
                  onClick={async () => {
                    if (editTimeModal.entry.id) {
                      await updateTimeEntry(editTimeModal.entry.id, {
                        objectId: editTimeModal.entry.object_id,
                        startTime: editTimeModal.entry.start_time,
                        endTime: editTimeModal.entry.end_time,
                        lunchMin: editTimeModal.entry.lunch_min,
                        hoursTotal: editTimeModal.entry.hours_total
                      })
                      showToast('Время обновлено')
                    } else {
                      await createTimeEntry({
                        workerId: editTimeModal.entry.worker_id,
                        brigadeId: editTimeModal.entry.brigade_id,
                        objectId: editTimeModal.entry.object_id,
                        date: editTimeModal.entry.date,
                        startTime: editTimeModal.entry.start_time,
                        endTime: editTimeModal.entry.end_time,
                        lunchMin: editTimeModal.entry.lunch_min,
                        hoursTotal: editTimeModal.entry.hours_total
                      })
                      showToast('Время успешно добавлено')
                    }
                    setEditTimeModal(null)
                    getMonthlyTimesheet(monthIdx, year, activeTab).then(setTimesheetData)
                    loadData()
                  }}
                  style={{padding:'12px 24px', borderRadius:10, background:'var(--blue)', border:'none', color:'#fff', fontWeight:800, cursor:'pointer', boxShadow:'0 4px 15px rgba(59,130,246,0.3)'}}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:'fixed', bottom:30, left:'50%', transform:'translateX(-50%)', background:'var(--blue)', color:'#fff', padding:'12px 24px', borderRadius:12, zIndex:1000, fontWeight:700, boxShadow:'0 10px 30px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:10}}>
          <Check size={18}/> {toast}
        </div>
      )}
    </AppLayout>
  )
}
