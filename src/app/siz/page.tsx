'use client'
import { useState, useMemo, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import {
  Plus, X, HardHat, Shield, Search, AlertTriangle,
  Check, RotateCcw, User, Calendar, Package,
  ChevronDown, ChevronUp, CheckSquare, Square, Send, Filter
} from 'lucide-react'

import { getSizItems, issueSizItem, updateSizStatus, PPEItem, PPECategory, PPEStatus } from '@/actions/siz'
import { getWorkers, getObjects } from '@/actions/common'

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────
const SIZES    = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']

const CATEGORIES: Record<PPECategory, {label:string; icon:string; color:string}> = {
  head:        {label:'Голова',      icon:'⛑️',  color:'#f97316'},
  hands:       {label:'Руки',        icon:'🧤',  color:'#3b82f6'},
  feet:        {label:'Ноги/Обувь',  icon:'👢',  color:'#8b5cf6'},
  body:        {label:'Тело',        icon:'🦺',  color:'#f59e0b'},
  eyes:        {label:'Глаза',       icon:'🥽',  color:'#06b6d4'},
  hearing:     {label:'Слух',        icon:'🎧',  color:'#10b981'},
  respiratory: {label:'Дыхание',     icon:'😷',  color:'#ef4444'},
  fall:        {label:'Страховка',   icon:'🪝',  color:'#ec4899'},
}

const STATUS_LABEL: Record<PPEStatus,string> = {active:'Выдано',returned:'Возвращено',expired:'Истёк срок',lost:'Утеря'}
const STATUS_BADGE: Record<PPEStatus,string> = {active:'badge-green',returned:'badge-gray',expired:'badge-red',lost:'badge-orange'}

function daysLeft(dateStr:string): number {
  if (!dateStr) return 0
  const d = new Date(dateStr.split('.').reverse().join('-'))
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}
function todayStr() {
  return new Date().toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'.')
}
function addDays(base:string, days:number): string {
  const parts = base.split('.').reverse().join('-')
  const d = new Date(parts)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'.')
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function PPEPage() {
  const [items, setItems]       = useState<PPEItem[]>([])
  const [dbWorkers, setDbWorkers] = useState<any[]>([])
  const [dbObjects, setDbObjects] = useState<string[]>([])
  
  const loadInitial = async () => {
    const [siz, workers, objects] = await Promise.all([
      getSizItems(),
      getWorkers(),
      getObjects()
    ])
    setItems(siz)
    setDbWorkers(workers)
    setDbObjects(objects)
  }

  useEffect(() => { loadInitial() }, [])

  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState<PPECategory|'all'>('all')
  const [stFilter, setStFilter]   = useState<PPEStatus|'all'>('all')
  const [showForm, setShowForm]   = useState(false)
  const [toast, setToast]         = useState('')
  const [expandedWorkers, setExpW] = useState<Set<string>>(new Set())

  // Form state
  const [fName,    setFName]    = useState('')
  const [fCat,     setFCat]     = useState<PPECategory>('head')
  const [fWorker,  setFWorker]  = useState('')
  const [fObject,  setFObject]  = useState('')
  const [fQty,     setFQty]     = useState('1')
  const [fUnit,    setFUnit]    = useState('шт')
  const [fSize,    setFSize]    = useState('')
  const [fNote,    setFNote]    = useState('')
  const [fExpDays, setFExpDays] = useState('365')

  // Auto-suggest size based on worker profile
  useEffect(() => {
    if (fWorker) {
      const worker = dbWorkers.find(w => w.name === fWorker)
      if (worker) {
        if (fCat === 'feet' && worker.shoe_size) {
           setFSize(String(worker.shoe_size))
        } else if (fCat === 'body' && worker.clothing_size) {
           setFSize(worker.clothing_size)
        }
      }
    }
  }, [fWorker, fCat, dbWorkers])

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000) }

  const filtered = useMemo(()=>{
    let list = [...items]
    if(catFilter!=='all') list = list.filter(i=>i.category===catFilter)
    if(stFilter!=='all')  list = list.filter(i=>i.status===stFilter)
    if(search){const q=search.toLowerCase();list=list.filter(i=>i.name.toLowerCase().includes(q)||i.worker.toLowerCase().includes(q)||i.object.toLowerCase().includes(q))}
    return list
  },[items,catFilter,stFilter,search])

  // Group by worker for the worker-view
  const byWorker = useMemo(()=>{
    const m: Record<string, PPEItem[]> = {}
    filtered.filter(i=>i.status==='active').forEach(i=>{ if(!m[i.worker]) m[i.worker]=[]; m[i.worker].push(i) })
    return m
  },[filtered])

  const stats = useMemo(()=>({
    total:   items.filter(i=>i.status==='active').length,
    expired: items.filter(i=>i.status==='expired').length,
    workers: new Set(items.filter(i=>i.status==='active').map(i=>i.worker)).size,
    soon:    items.filter(i=>i.status==='active'&&daysLeft(i.expiryDate)<=30).length,
  }),[items])

  const markStatus = async (id:string, status:PPEStatus) => {
    const dStr = status==='returned'?todayStr():undefined
    setItems(prev=>prev.map(i=>i.id===id?{...i,status,returnedDate:status==='returned'?todayStr():i.returnedDate}:i))
    showToast(status==='returned'?'Отмечено как возвращено':status==='lost'?'Отмечена утеря':'Статус обновлён')
    await updateSizStatus(id, status, dStr)
  }

  const issueItem = async () => {
    if(!fName.trim()||!fWorker||!fObject) return
    const today = todayStr()
    const payload = {
      name:fName.trim(), category:fCat, worker:fWorker, object:fObject,
      issuedDate:today, expiryDate:addDays(today,parseInt(fExpDays)||365),
      qty:parseInt(fQty)||1, unit:fUnit,
      size:fSize||undefined, note:fNote||undefined
    }
    
    // Opt update
    const ni = {id:'tmp-'+Date.now(), status:'active' as PPEStatus, ...payload}
    setItems(p=>[ni,...p])
    
    setFName('');setFWorker('');setFObject('');setFQty('1');setFSize('');setFNote('');setFExpDays('365')
    setShowForm(false)
    showToast(`Выдано: ${ni.name} → ${ni.worker}`)
    
    const res = await issueSizItem(payload)
    if(res.success && res.id) {
       setItems(p=>p.map(i=>i.id===ni.id?{...i,id:res.id!}:i))
    }
  }

  const toggleWorker = (w:string) => setExpW(s=>{const n=new Set(s);n.has(w)?n.delete(w):n.add(w);return n})

  const S = {padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header" style={{marginBottom:16}}>
        <h1 style={{color:'#fff',display:'flex',alignItems:'center',gap:10}}><HardHat size={22} color="#f97316"/> СИЗ — средства защиты</h1>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {stats.expired>0&&<span className="badge-pill badge-red">⚠️ {stats.expired} истёк срок</span>}
          {stats.soon>0&&<span className="badge-pill badge-yellow">⏰ {stats.soon} скоро истекает</span>}
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(s=>!s)}><Plus size={14}/> Выдать СИЗ</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
        {[
          {label:'Активных выдач', value:stats.total, color:'#22c55e', bg:'rgba(34,197,94,0.1)', icon:'🦺'},
          {label:'Сотрудников',    value:stats.workers, color:'#3b82f6', bg:'rgba(59,130,246,0.1)', icon:'👷'},
          {label:'Истёк срок',    value:stats.expired, color:'#ef4444', bg:'rgba(239,68,68,0.1)', icon:'⚠️'},
          {label:'Истекает <30дн',value:stats.soon,   color:'#eab308', bg:'rgba(234,179,8,0.1)', icon:'⏰'},
        ].map(s=>(
          <div key={s.label} style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',padding:'16px 20px'}}>
            <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:26,fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Issue form */}
      {showForm&&(
        <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',marginBottom:16,overflow:'hidden'}}>
          <div style={{background:'var(--bg-elevated)',padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontWeight:800,fontSize:15,color:'#fff'}}>Выдать СИЗ</div>
            <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer'}}><X size={18}/></button>
          </div>
          <div style={{padding:20}}>
            {/* Category pills */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:8}}>Категория СИЗ</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {(Object.entries(CATEGORIES) as [PPECategory,{label:string;icon:string;color:string}][]).map(([k,v])=>(
                  <button key={k} onClick={()=>setFCat(k)}
                    style={{padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:`2px solid ${fCat===k?v.color:'rgba(255,255,255,0.08)'}`,background:fCat===k?`${v.color}22`:'transparent',color:fCat===k?v.color:'rgba(255,255,255,0.4)',transition:'all .15s'}}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:6}}>Наименование СИЗ</label>
                <input value={fName} onChange={e=>setFName(e.target.value)} placeholder="Каска, перчатки, жилет..."
                  style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'10px 12px',fontSize:14,color:'#fff',outline:'none'}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:6}}>Кол-во</label>
                <div style={{display:'flex',gap:6}}>
                  <input type="number" min="1" value={fQty} onChange={e=>setFQty(e.target.value)}
                    style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'10px 12px',fontSize:14,color:'#fff',fontWeight:700,outline:'none'}}/>
                  <input value={fUnit} onChange={e=>setFUnit(e.target.value)} placeholder="шт"
                    style={{width:52,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'10px 8px',fontSize:14,color:'#fff',outline:'none'}}/>
                </div>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:6}}>Размер</label>
                <input list="siz-sizes" value={fSize} onChange={e=>setFSize(e.target.value)} placeholder="52-54 или 42"
                  style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'10px 12px',fontSize:14,color:'#fff',outline:'none'}}/>
                <datalist id="siz-sizes">
                  {SIZES.map(s=><option key={s} value={s} />)}
                </datalist>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:6}}>Сотрудник</label>
                <select value={fWorker} onChange={e=>setFWorker(e.target.value)}
                  style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid:rgba(255,255,255,0.1)',borderRadius:6,padding:'10px 12px',fontSize:14,color:'#fff',outline:'none',borderColor:!fWorker?'var(--accent)':undefined}}>
                  <option value="">Выбрать...</option>
                  {dbWorkers.map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:6}}>Объект</label>
                <select value={fObject} onChange={e=>setFObject(e.target.value)}
                  style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'10px 12px',fontSize:14,color:'#fff',outline:'none'}}>
                  <option value="">Выбрать...</option>
                  {dbObjects.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:6}}>Срок службы (дней)</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[30,90,180,365].map(d=>(
                    <button key={d} onClick={()=>setFExpDays(String(d))}
                      style={{flex:1,padding:'10px 4px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',border:`2px solid ${fExpDays===String(d)?'var(--accent)':'rgba(255,255,255,0.08)'}`,background:fExpDays===String(d)?'var(--accent-dim)':'transparent',color:fExpDays===String(d)?'var(--accent)':'rgba(255,255,255,0.4)'}}>
                      {d}д
                    </button>
                  ))}
                  <input type="number" value={fExpDays} onChange={e=>setFExpDays(e.target.value)} placeholder="дней"
                    style={{flex:1,minWidth:50,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'10px 8px',fontSize:13,color:'#fff',outline:'none',textAlign:'center'}}/>
                </div>
              </div>
            </div>

            <input value={fNote} onChange={e=>setFNote(e.target.value)} placeholder="💬 Примечание (модель, артикул)..."
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'9px 12px',fontSize:13,color:'rgba(255,255,255,0.7)',outline:'none',marginBottom:12}}/>

            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,color:'rgba(255,255,255,0.5)',fontWeight:600,cursor:'pointer',fontSize:13}}>Отмена</button>
              <button onClick={issueItem} disabled={!fName.trim()||!fWorker||!fObject}
                style={{flex:3,padding:'13px',border:'none',borderRadius:6,background:(!fName.trim()||!fWorker||!fObject)?'rgba(255,255,255,0.06)':'var(--accent)',color:(!fName.trim()||!fWorker||!fObject)?'rgba(255,255,255,0.2)':'#fff',fontWeight:800,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <Check size={16}/> Выдать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',padding:'12px 16px',marginBottom:12,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:160}}>
          <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.3)'}}/>
          <input placeholder="Поиск по имени, сотруднику..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 12px 8px 32px',fontSize:13,color:'#fff',outline:'none'}}/>
        </div>
        <select value={stFilter} onChange={e=>setStFilter(e.target.value as any)}
          style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 12px',fontSize:13,color:'#fff',outline:'none'}}>
          <option value="all">Все статусы</option>
          {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={()=>setCatFilter('all')} style={{padding:'6px 12px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid rgba(255,255,255,0.1)',background:catFilter==='all'?'var(--accent)':'transparent',color:catFilter==='all'?'#fff':'rgba(255,255,255,0.5)'}}>Все</button>
          {(Object.entries(CATEGORIES) as [PPECategory,{label:string;icon:string;color:string}][]).map(([k,v])=>(
            <button key={k} onClick={()=>setCatFilter(k)}
              style={{padding:'6px 10px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:`1px solid ${catFilter===k?v.color:'rgba(255,255,255,0.1)'}`,background:catFilter===k?`${v.color}22`:'transparent',color:catFilter===k?v.color:'rgba(255,255,255,0.4)'}}>
              {v.icon}
            </button>
          ))}
        </div>
      </div>

      {/* ── By Worker view ── */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8,paddingLeft:4}}>
          Активные — по сотрудникам
        </div>
        {Object.entries(byWorker).map(([worker, witems])=>{
          const exp = expandedWorkers.has(worker)
          const hasWarning = witems.some(i=>daysLeft(i.expiryDate)<=30)
          const hasExpired = witems.some(i=>i.status==='expired')
          return (
            <div key={worker} style={{background:'var(--bg-surface)',border:`1px solid ${hasWarning||hasExpired?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.08)'}`,borderRadius:'var(--radius)',marginBottom:8,overflow:'hidden'}}>
              <div onClick={()=>toggleWorker(worker)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',background:exp?'rgba(255,255,255,0.02)':'transparent'}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'rgba(255,255,255,0.7)',flexShrink:0}}>
                  {worker.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#fff'}}>{worker}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>{witems.length} позиций СИЗ</div>
                </div>
                {(hasWarning||hasExpired)&&<AlertTriangle size={16} color="var(--orange)"/>}
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {Array.from(new Set(witems.map(i=>i.category))).map(c=>(
                    <span key={c} style={{fontSize:16}} title={CATEGORIES[c].label}>{CATEGORIES[c].icon}</span>
                  ))}
                </div>
                {exp?<ChevronUp size={16} color="rgba(255,255,255,0.4)"/>:<ChevronDown size={16} color="rgba(255,255,255,0.4)"/>}
              </div>

              {exp&&(
                <div style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                  {witems.map(item=>{
                    const dl = daysLeft(item.expiryDate)
                    const warn = dl<=30 && dl>0
                    const expired = dl<=0 || item.status==='expired'
                    return (
                      <div key={item.id} style={{padding:'12px 16px 12px 68px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',alignItems:'center',gap:12,background:expired?'rgba(239,68,68,0.04)':warn?'rgba(234,179,8,0.03)':undefined}}>
                        <div style={{fontSize:22,flexShrink:0}}>{CATEGORIES[item.category].icon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:14,color:'#fff',marginBottom:2}}>{item.name}
                            {item.size&&<span style={{marginLeft:6,fontSize:11,color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.06)',borderRadius:4,padding:'1px 6px'}}>{item.size}</span>}
                          </div>
                          <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',display:'flex',gap:8,flexWrap:'wrap'}}>
                            <span>📍 {item.object}</span>
                            <span>Выдано: {item.issuedDate}</span>
                            <span style={{color:expired?'#ef4444':warn?'#eab308':'rgba(255,255,255,0.4)'}}>
                              {expired?'🚨 Срок истёк!':warn?`⏰ Через ${dl} дн.`:`До ${item.expiryDate}`}
                            </span>
                          </div>
                          {item.note&&<div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>💬 {item.note}</div>}
                        </div>
                        <div style={{fontWeight:800,fontSize:18,color:'#fff'}}>{item.qty} <span style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.4)'}}>{item.unit}</span></div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button onClick={()=>markStatus(item.id,'returned')}
                            title="Возврат"
                            style={{padding:'7px 12px',background:'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:6,color:'#60a5fa',fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                            <RotateCcw size={12}/> Возврат
                          </button>
                          <button onClick={()=>markStatus(item.id,'lost')}
                            title="Утеря"
                            style={{padding:'7px 10px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:6,color:'#ef4444',fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                            <X size={12}/> Утеря
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Alerts: expired / returned / lost ── */}
      {filtered.filter(i=>i.status!=='active').length>0&&(
        <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',overflow:'hidden'}}>
          <div style={{padding:'12px 16px',background:'rgba(239,68,68,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',fontWeight:700,fontSize:13,color:'#ef4444'}}>
            ⚠️ Истёк срок / Возвращено / Утеря
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'rgba(255,255,255,0.02)'}}>
                {['СИЗ','Сотрудник','Объект','Кол-во','Статус','Дата'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.4)',textAlign:'left',textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.filter(i=>i.status!=='active').map(item=>(
                <tr key={item.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <td style={{padding:'11px 14px'}}>
                    <div style={{fontWeight:600,color:'#fff',display:'flex',alignItems:'center',gap:6}}>
                      <span>{CATEGORIES[item.category].icon}</span>{item.name}
                    </div>
                  </td>
                  <td style={{padding:'11px 14px',color:'rgba(255,255,255,0.7)'}}>{item.worker}</td>
                  <td style={{padding:'11px 14px',color:'rgba(255,255,255,0.5)',fontSize:12}}>{item.object}</td>
                  <td style={{padding:'11px 14px',color:'#fff',fontWeight:700}}>{item.qty} {item.unit}</td>
                  <td style={{padding:'11px 14px'}}>
                    <span className={`badge-pill ${STATUS_BADGE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                  </td>
                  <td style={{padding:'11px 14px',color:'rgba(255,255,255,0.4)',fontSize:12}}>
                    {item.returnedDate||item.expiryDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
