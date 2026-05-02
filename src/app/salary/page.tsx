'use client'
import { useState, useMemo, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import {
  Banknote, Search, Check, ChevronLeft, ChevronRight,
  TrendingDown, TrendingUp, HandCoins, CheckCircle2,
  Users, Briefcase, FileSignature, Landmark, Trash2
} from 'lucide-react'

import { getSalaryData, updateBrigadePot, updateWorkerRate, addFinanceRecord, resetFinanceRecord, BrigadeSalaryData, WorkerSalaryData } from '@/actions/salary'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function formatMoney(amount: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function SalaryPage() {
  const [brigades, setBrigades] = useState<BrigadeSalaryData[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  
  const [monthIdx, setMonthIdx] = useState(3) // Апрель
  const [year, setYear] = useState(2026)
  
  // Modals / Inputs
  const [advModal, setAdvModal] = useState<{wid:string}|null>(null)
  const [adjModal, setAdjModal] = useState<{wid:string, type:'bonus'|'penalty'}|null>(null)
  const [numInput, setNumInput] = useState('')
  const [toast, setToast] = useState('')

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
  }, [monthIdx, year])

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
                        <div style={{width:60, textAlign:'center', display:'inline-block', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'6px', color: w.hours > 0 ? '#fff' : 'var(--text-muted)', outline:'none'}}>
                          {w.hours} ч
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
    </AppLayout>
  )
}
