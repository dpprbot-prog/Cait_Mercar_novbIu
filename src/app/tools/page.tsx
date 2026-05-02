'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import {
  Wrench, Plus, X, Search, Check, AlertTriangle, RotateCcw,
  ChevronDown, ChevronUp, Users, User, Camera, Reply,
  HardHat, FileText, CheckCircle2, Trash, Download
} from 'lucide-react'
import { getTools, addTool, initiateToolTransfer, respondToolTransfer, sendToolToRepair, returnToolFromRepair, requestToolWriteOff, resolveToolWriteOff, ToolItem, ToolStatus, ToolCategory, AssigneeType } from '@/actions/tools'
import { exportToolsExcel } from '@/actions/export'
import { useAuth } from '@/components/AuthProvider'
import Modal from '@/components/Modal'

// ─────────────────────────────────────────────
//  Types & Config
// ─────────────────────────────────────────────




const CATEGORIES: Record<ToolCategory,{label:string;icon:string;color:string}> = {
  power:     {label:'Электро',   icon:'⚡', color:'#eab308'},
  hand:      {label:'Ручной',    icon:'🔨', color:'#f97316'},
  measuring: {label:'Измерит.',  icon:'📐', color:'#3b82f6'},
  lifting:   {label:'Подъём',    icon:'🏗️', color:'#8b5cf6'},
  welding:   {label:'Сварка',    icon:'🔥', color:'#ef4444'},
  concrete:  {label:'Бетон',     icon:'🪨', color:'#6b7280'},
  other:     {label:'Прочее',    icon:'🔧', color:'#10b981'},
}

const STATUS_LABEL: Record<ToolStatus,string> = {
  available:'На складе', issued:'Выдан', repair:'В ремонте', lost:'Утеря',
  written_off:'Списан', pending_transfer:'Ожидает принятия', pending_writeoff:'Заявка на списание'
}
const STATUS_BADGE: Record<ToolStatus,string> = {
  available:'badge-green', issued:'badge-blue', repair:'badge-yellow', lost:'badge-red',
  written_off:'badge-gray', pending_transfer:'badge-orange', pending_writeoff:'badge-red'
}
const COND_COLOR: Record<string,string> = {good:'#22c55e',fair:'#eab308',bad:'#ef4444'}

let cnt = 500
const nid = () => String(++cnt)
function todayStr() { return new Date().toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'.') }
function formatTime() { return new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) }
function addDays(base:string, days:number): string {
  const parts = base.split('.').reverse().join('-')
  const d = new Date(parts); d.setDate(d.getDate() + days)
  return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'.')
}

// ─────────────────────────────────────────────
//  Mock data
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function ToolsPage() {
  // Data Lists
  const [workersList, setWorkersList] = useState<string[]>([])
  const [brigadesList, setBrigadesList] = useState<string[]>([])
  const [objectsList, setObjectsList] = useState<string[]>([])

  const [tools, setTools] = useState<ToolItem[]>([])
  
  useEffect(() => {
    refreshData()
    // Fetch auxiliary data
    import('@/actions/common').then(m => {
      m.getWorkers().then(res => setWorkersList(res.map((w:any) => w.name)))
      m.getObjects().then(setObjectsList)
      m.getBrigades().then(res => setBrigadesList(res.map((b:any) => b.name)))
    })
  }, [])

  const refreshData = async () => {
    const data = await getTools()
    setTools(data)
  }

  const { user } = useAuth()
  const isAdmin = user?.role === 'Админ'
  const isSklad = user?.role === 'Склад'
  const currentUser = isAdmin ? 'Админ' : isSklad ? 'Склад' : user?.name || ''
  
  // Filters
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<ToolCategory|'all'>('all')
  const [expandCat, setExpandCat] = useState<Set<string>>(new Set(['power','hand','measuring','welding','concrete']))

  // Modals
  const [showAddForm, setShowAddForm] = useState(false)
  const [transferModal, setTransferModal] = useState<string|null>(null) // tool id
  const [repairModal, setRepairModal] = useState<string|null>(null)
  const [writeoffModal, setWriteoffModal] = useState<string|null>(null)
  const [modal, setModal] = useState<{isOpen:boolean, title:string, message:string, type:'info'|'danger'|'warning', onConfirm?:()=>void}>({
    isOpen: false, title: '', message: '', type: 'info'
  })

  const [toast, setToast] = useState('')
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000) }

  // New Tool Form
  const [fName, setFName] = useState('')
  const [fCat, setFCat] = useState<ToolCategory>('power')
  const [fInv, setFInv] = useState('')
  const [fQty, setFQty] = useState('1')
  const [fCond, setFCond] = useState<'good'|'fair'|'bad'>('good')

  // Transfer Form
  const [trToType, setTrToType] = useState<AssigneeType>('worker')
  const [trTo, setTrTo] = useState('')
  const [trObj, setTrObj] = useState('')

  // Repair Form
  const [repLoc, setRepLoc] = useState('')

  // Write-off Form
  const [woReason, setWoReason] = useState('')
  const [woPhoto, setWoPhoto] = useState<string|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─────────────────────────────────────────────
  //  Actions
  // ─────────────────────────────────────────────
  const addToolClick = async () => {
    if(!fName.trim()) return
    const ts = Date.now().toString()
    const payload: Partial<ToolItem> = {
      name:fName,category:fCat,inventoryNum:fInv||`ИН-${ts.slice(-4)}`,condition:fCond,status:'available',qty:parseInt(fQty)||1,unit:'шт'
    }
    const nt = {id:'t'+ts, ...payload} as ToolItem
    setTools(p=>[nt,...p])
    setFName('');setFInv('');setFQty('1')
    setShowAddForm(false)
    showToast(`Добавлено: ${nt.name}`)
    await addTool(payload)
    refreshData()
  }

  const handleDeleteTool = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setModal({
      isOpen: true,
      title: 'Удаление инструмента',
      message: `Вы уверены, что хотите окончательно удалить "${name}" из базы?`,
      type: 'danger',
      onConfirm: async () => {
        import('@/actions/tools').then(async m => {
          const res = await m.deleteTool(id)
          if (res.success) {
            showToast('Удалено')
            refreshData()
          }
        })
        setModal(p => ({ ...p, isOpen: false }))
      }
    })
  }

  // Запуск передачи (со склада или от мастера)
  const startTransfer = async (id:string) => {
    if(!trTo) return
    const dt = `${todayStr()} ${formatTime()}`
    
    setTools(p=>p.map(t=>{
      if(t.id!==id) return t
      return {
        ...t, status: 'pending_transfer',
        transfer_from: currentUser, transfer_to: trTo, transfer_toType: trToType, transfer_date: dt, transfer_object: trObj || t.issuedObject
      }
    }))
    showToast(`Отправлен запрос на передачу: ${trTo}`)
    
    const obj = trObj || tools.find(t=>t.id===id)?.issuedObject || undefined
    await initiateToolTransfer(id, {from: currentUser, to: trTo, toType: trToType, date: dt, object: obj})
    setTransferModal(null); setTrTo(''); setTrObj('')
    refreshData()
  }

  // Принятие/Отклонение передачи
  const respondTransfer = async (id:string, accept:boolean) => {
    const tItem = tools.find(x => x.id === id)
    if (!tItem) return
    
    setTools(p=>p.map(t=>{
      if(t.id!==id) return t
      if(accept) {
        if(t.transfer_to === 'Склад') {
          return {...t, status:'available', transfer_from:null, transfer_to:null, transfer_toType:null, transfer_object:null, assigneeType:null, issuedTo:null, issuedObject:null}
        }
        return {...t, status:'issued', assigneeType:t.transfer_toType, issuedTo:t.transfer_to, issuedObject:t.transfer_object||t.issuedObject, issuedDate:todayStr(), transfer_from:null, transfer_to:null, transfer_toType:null, transfer_object:null}
      } else {
        return {...t, status: t.issuedTo ? 'issued' : 'available', transfer_from:null, transfer_to:null, transfer_toType:null, transfer_object:null}
      }
    }))
    showToast(accept ? 'Инструмент принят' : 'Передача отклонена')
    await respondToolTransfer(id, accept, tItem.transfer_to||'', tItem.transfer_toType||'', tItem.transfer_object||tItem.issuedObject||'', tItem.issuedTo||null)
    refreshData()
  }

  // Ремонт
  const sendToRepairClick = async (id:string) => {
    if(!repLoc) return
    setTools(p=>p.map(t=>t.id===id?{...t, status:'repair', repair_location:repLoc, repair_sentDate:todayStr()}:t))
    showToast('Инструмент отправлен в ремонт')
    await sendToolToRepair(id, repLoc, todayStr())
    setRepairModal(null); setRepLoc('')
    refreshData()
  }

  const returnFromRepairClick = async (id:string) => {
    setTools(p=>p.map(t=>t.id===id?{...t, status:'available', repair_location:null, repair_sentDate:null, condition:'good'}:t))
    showToast('Возвращён из ремонта')
    await returnToolFromRepair(id)
    refreshData()
  }

  // Заявка на списание
  const requestWriteOffClick = async (id:string) => {
    if(!woReason) return
    setTools(p=>p.map(t=>t.id===id?{...t, status:'pending_writeoff', writeoff_reason:woReason, writeoff_photo:woPhoto, writeoff_requestedBy:currentUser, writeoff_date:todayStr()}:t))
    showToast('Заявка на списание отправлена Админу')
    await requestToolWriteOff(id, woReason, woPhoto, currentUser, todayStr())
    setWriteoffModal(null); setWoReason(''); setWoPhoto(null)
    refreshData()
  }

  // Рассмотрение заявки (Админ)
  const resolveWriteOffClick = async (id:string, approve:boolean) => {
    const tItem = tools.find(x => x.id === id)
    setTools(p=>p.map(t=>{
      if(t.id!==id) return t
      if(approve) return {...t, status:'written_off', writeoff_reason:null, assigneeType:null, issuedTo:null, issuedObject:null}
      return {...t, status:t.issuedTo?'issued':'available', writeoff_reason:null}
    }))
    showToast(approve ? 'Списание подтверждено' : 'Списание отклонено')
    await resolveToolWriteOff(id, approve, tItem?.issuedTo||null)
    refreshData()
  }

  const handleExport = async () => {
    const res = await exportToolsExcel()
    if (res.success && res.base64) {
      const byteCharacters = atob(res.base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.style.display = 'none'
      link.href = url
      link.setAttribute('download', res.fileName)
      
      document.body.appendChild(link)
      link.click()
      
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }, 100)
    }
  }

  // File handling
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if(e.target.files && e.target.files[0]) {
      setWoPhoto(URL.createObjectURL(e.target.files[0]))
    }
  }

  // ─────────────────────────────────────────────
  //  Rendering Data
  // ─────────────────────────────────────────────
  const filtered = useMemo(()=>{
    let list = [...tools]
    if(catFilter!=='all') list = list.filter(t=>t.category===catFilter)
    if(search){const q=search.toLowerCase();list=list.filter(t=>t.name.toLowerCase().includes(q)||t.inventoryNum.toLowerCase().includes(q)||(t.issuedTo?.toLowerCase().includes(q)??false))}
    return list
  },[tools,catFilter,search])

  const byCategory = useMemo(()=>{
    const m: Record<string, ToolItem[]> = {}
    filtered.forEach(t=>{ if(!m[t.category]) m[t.category]=[]; m[t.category].push(t) })
    return m
  },[filtered])

  // Мои активные задачи
  const myIncomingTransfers = tools.filter(t=>t.status==='pending_transfer' && t.transfer_to === currentUser)
  const myPendingWriteoffs = isAdmin ? tools.filter(t=>t.status==='pending_writeoff') : []

  return (
    <AppLayout>

      {/* ── Page Header ── */}
      <div className="page-header" style={{marginBottom:16}}>
        <h1 style={{color:'#fff',display:'flex',alignItems:'center',gap:10}}><Wrench size={22} color="#eab308"/> Инструмент</h1>
        <div style={{display:'flex', gap:10}}>
          {(isSklad || isAdmin) && <button className="btn btn-primary btn-sm" style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)'}} onClick={handleExport}><Download size={14}/> Экспорт</button>}
          {(isSklad || isAdmin) && <button className="btn btn-primary btn-sm" onClick={()=>setShowAddForm(s=>!s)}><Plus size={14}/> Добавить на склад</button>}
        </div>
      </div>

      {/* ── Add Form ── */}
      {showAddForm && (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:16,marginBottom:16}}>
          <h3 style={{fontSize:15,color:'#fff',marginBottom:12}}>Новый инструмент</h3>
            <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:10,marginBottom:12}}>
              <input placeholder="Название (напр. Перфоратор)" value={fName} onChange={e=>setFName(e.target.value)} style={{gridColumn:'span 2',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'8px 12px',color:'#fff',outline:'none'}} />
              
              <div style={{position:'relative'}}>
                <input 
                  list="tool-cats"
                  value={fCat} 
                  onChange={e=>setFCat(e.target.value as ToolCategory)}
                  placeholder="Категория..."
                  style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'8px 12px',color:'#fff',outline:'none'}}
                />
                <datalist id="tool-cats">
                  {(Object.entries(CATEGORIES) as [ToolCategory,{label:string}][]).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </datalist>
              </div>

              <input placeholder="Инвентарный № (авто)" value={fInv} onChange={e=>setFInv(e.target.value)} style={{background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'8px 12px',color:'#fff',outline:'none'}} />
              
              <div style={{position:'relative'}}>
                <input 
                  list="tool-conds"
                  value={fCond} 
                  onChange={e=>setFCond(e.target.value as any)}
                  placeholder="Состояние..."
                  style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'8px 12px',color:'#fff',outline:'none'}}
                />
                <datalist id="tool-conds">
                  <option value="good">Отличное</option>
                  <option value="fair">Удовлетворительное</option>
                  <option value="bad">Плохое</option>
                </datalist>
              </div>

              <input placeholder="Кол-во" value={fQty} type="number" onChange={e=>setFQty(e.target.value)} style={{background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'8px 12px',color:'#fff',outline:'none'}} />
            </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setShowAddForm(false)} style={{flex:1,padding:'8px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-muted)',fontWeight:600}}>Отмена</button>
            <button onClick={addToolClick} disabled={!fName.trim()} style={{flex:2,padding:'8px',background:'var(--accent)',border:'none',borderRadius:6,color:'#fff',fontWeight:700,opacity:!fName.trim()?0.5:1}}>Создать</button>
          </div>
        </div>
      )}

      {/* ── Action Required Panel ── */}
      {(myIncomingTransfers.length > 0 || myPendingWriteoffs.length > 0) && (
        <div style={{marginBottom:20}}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:8}}>Требует вашего участия</h3>
          <div style={{display:'grid',gap:10}}>
            {/* Входящие передачи */}
            {myIncomingTransfers.map(t=>(
              <div key={t.id} style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'var(--radius)',padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                <Reply size={20} color="var(--orange)" />
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:'var(--orange)',fontWeight:700,marginBottom:2}}>Вам передают инструмент ({t.transfer_from})</div>
                  <div style={{fontWeight:800,fontSize:15,color:'#fff'}}>{t.name} <span style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:500}}>{t.inventoryNum}</span></div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>respondTransfer(t.id, false)} style={{padding:'8px 12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'rgba(255,255,255,0.6)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Отказаться</button>
                  <button onClick={()=>respondTransfer(t.id, true)} style={{padding:'8px 14px',background:'var(--orange)',border:'none',borderRadius:6,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><CheckCircle2 size={16}/> Принять</button>
                </div>
              </div>
            ))}
            {/* Заявки на списание (для Админа) */}
            {myPendingWriteoffs.map(t=>(
              <div key={t.id} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius)',padding:'12px 16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <FileText size={18} color="var(--red)"/>
                    <span style={{fontSize:13,color:'var(--red)',fontWeight:700}}>Заявка на списание от {t.writeoff_requestedBy}</span>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>resolveWriteOffClick(t.id, false)} style={{padding:'6px 12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'rgba(255,255,255,0.6)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Отклонить</button>
                    <button onClick={()=>resolveWriteOffClick(t.id, true)} style={{padding:'6px 12px',background:'var(--red)',border:'none',borderRadius:6,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>Списать</button>
                  </div>
                </div>
                <div style={{fontWeight:800,fontSize:15,color:'#fff',marginBottom:4}}>{t.name} <span style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:500}}>{t.inventoryNum}</span></div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',padding:'8px 12px',background:'rgba(255,255,255,0.04)',borderRadius:6}}>💬 Причина: {t.writeoff_reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main List Filters ── */}
      <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',padding:'12px 16px',marginBottom:12,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:160}}>
          <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.3)'}}/>
          <input placeholder="Поиск инструмента, сотрудника..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 12px 8px 32px',fontSize:13,color:'#fff',outline:'none'}}/>
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          <button onClick={()=>setCatFilter('all')} style={{padding:'5px 10px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid rgba(255,255,255,0.1)',background:catFilter==='all'?'var(--accent)':'transparent',color:catFilter==='all'?'#fff':'var(--text-muted)'}}>Все</button>
          {(Object.entries(CATEGORIES) as [ToolCategory,{label:string;icon:string}][]).map(([k,v])=>(
            <button key={k} onClick={()=>setCatFilter(k)} style={{padding:'5px 10px',borderRadius:20,fontSize:11,cursor:'pointer',border:`1px solid ${catFilter===k?CATEGORIES[k].color:'rgba(255,255,255,0.1)'}`,background:catFilter===k?`${CATEGORIES[k].color}22`:'transparent',color:catFilter===k?CATEGORIES[k].color:'var(--text-muted)',fontWeight:700}}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tool Categories ── */}
      {Object.entries(byCategory).map(([cat, catTools])=>{
        const cv = CATEGORIES[cat as ToolCategory]
        const exp = expandCat.has(cat)
        return (
          <div key={cat} style={{marginBottom:10,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            <div onClick={()=>setExpandCat(s=>{const n=new Set(s);n.has(cat)?n.delete(cat):n.add(cat);return n})} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',background:exp?'rgba(255,255,255,0.02)':'transparent'}}>
              <span style={{fontSize:20}}>{cv.icon}</span>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:cv.color}}>{cv.label}</div></div>
              {exp?<ChevronUp size={16} color="var(--text-muted)"/>:<ChevronDown size={16} color="var(--text-muted)"/>}
            </div>

            {exp && catTools.map(tool=>(
              <div key={tool.id} style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.04)',display:'flex',alignItems:'center',gap:12}}>
                {/* Inv + Condition */}
                <div style={{flexShrink:0,textAlign:'center',width:60}}>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:2}}>{tool.inventoryNum}</div>
                  <div style={{width:8,height:8,borderRadius:'50%',background:COND_COLOR[tool.condition],margin:'0 auto'}}/>
                </div>

                {/* Info */}
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#fff',marginBottom:4}}>{tool.name}</div>
                  
                  {tool.status==='available' && <div style={{fontSize:12,color:'var(--green)'}}>📦 На складе</div>}
                  
                  {tool.status==='issued' && (
                    <div style={{fontSize:12,color:'var(--text-muted)',display:'flex',gap:8,flexWrap:'wrap'}}>
                      <span style={{color:'#fff'}}>{tool.assigneeType==='brigade'?'👥':'👷'} {tool.issuedTo}</span>
                      <span>📍 {tool.issuedObject}</span>
                    </div>
                  )}

                  {tool.status==='pending_transfer' && (
                    <div style={{fontSize:12,color:'var(--orange)'}}>
                      ⏳ Передача: <strong>{tool.transfer_from}</strong> → <strong>{tool.transfer_to}</strong>
                    </div>
                  )}

                  {tool.status==='repair' && (
                    <div style={{fontSize:12,color:'var(--yellow)'}}>
                      🛠️ Ремонт <strong>{tool.repair_location}</strong> (с {tool.repair_sentDate})
                    </div>
                  )}

                  {tool.status==='pending_writeoff' && (
                    <div style={{fontSize:12,color:'var(--red)'}}>
                      🚨 Заявка на списание от {tool.writeoff_requestedBy}
                    </div>
                  )}

                  {tool.status==='written_off' && <div style={{fontSize:12,color:'var(--text-muted)'}}>🗑️ Списан</div>}
                </div>

                {/* Actions (Role-based) */}
                <div style={{display:'flex',flexDirection:'column',gap:5,alignItems:'flex-end',minWidth:130}}>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    {isAdmin && (
                      <button 
                        onClick={(e) => handleDeleteTool(tool.id, tool.name, e)} 
                        title="Удалить инструмент"
                        style={{width:28, height:28, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.1)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.2)', transition:'all 0.2s', cursor:'pointer'}}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--red)'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='var(--red)'; }}
                      >
                        <Trash size={12}/>
                      </button>
                    )}
                    <span className={`badge-pill ${STATUS_BADGE[tool.status]}`} style={{fontSize:10}}>{STATUS_LABEL[tool.status]}</span>
                  </div>
                  
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                    {/* Кнопка "Передать" (Склад или текущий владелец) */}
                    {(tool.status==='available' && (isSklad || isAdmin)) || (tool.status==='issued' && tool.issuedTo===currentUser) ? (
                      <button onClick={()=>setTransferModal(tool.id)} style={{padding:'5px 10px',background:'var(--blue-dim)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:5,color:'var(--blue)',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        Передать
                      </button>
                    ):null}

                    {/* Вернуть на склад (для мастера) */}
                    {tool.status==='issued' && tool.issuedTo===currentUser && (
                      <button onClick={()=>{setTrTo('Склад'); setTrToType('worker'); startTransfer(tool.id)}} style={{padding:'5px 10px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:5,color:'var(--text-secondary)',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        Сдать
                      </button>
                    )}

                    {/* Ремонт (Склад или Владелец) */}
                    {['available','issued'].includes(tool.status) && (isSklad || isAdmin || tool.issuedTo===currentUser) && (
                      <button onClick={()=>setRepairModal(tool.id)} style={{padding:'5px 10px',background:'var(--yellow-dim)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:5,color:'var(--yellow)',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        В ремонт
                      </button>
                    )}

                    {/* Списание (Только владелец инициирует заявку) */}
                    {tool.status==='issued' && tool.issuedTo===currentUser && (
                      <button onClick={()=>setWriteoffModal(tool.id)} style={{padding:'5px 10px',background:'var(--red-dim)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:5,color:'var(--red)',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        Списать
                      </button>
                    )}

                    {/* Возврат из ремонта (Склад) */}
                    {tool.status==='repair' && (isSklad || isAdmin) && (
                      <button onClick={()=>returnFromRepairClick(tool.id)} style={{padding:'5px 10px',background:'var(--green-dim)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:5,color:'var(--green)',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        Готово
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {/* ── TRANSFER MODAL ── */}
      {transferModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius)',padding:24,width:'100%',maxWidth:400}}>
            <h3 style={{color:'#fff',marginBottom:16,display:'flex',alignItems:'center',gap:8}}><Reply size={18}/> Передать инструмент</h3>
            
            <div style={{display:'flex',gap:10,marginBottom:12}}>
              <button onClick={()=>setTrToType('worker')} style={{flex:1,padding:'8px',borderRadius:6,border:`1px solid ${trToType==='worker'?'var(--accent)':'rgba(255,255,255,0.1)'}`,background:trToType==='worker'?'var(--accent-dim)':'transparent',color:trToType==='worker'?'var(--accent)':'var(--text-muted)',fontSize:12,fontWeight:600}}><User size={14} style={{verticalAlign:'middle',marginRight:4}}/> Сотруднику</button>
              <button onClick={()=>setTrToType('brigade')} style={{flex:1,padding:'8px',borderRadius:6,border:`1px solid ${trToType==='brigade'?'var(--accent)':'rgba(255,255,255,0.1)'}`,background:trToType==='brigade'?'var(--accent-dim)':'transparent',color:trToType==='brigade'?'var(--accent)':'var(--text-muted)',fontSize:12,fontWeight:600}}><Users size={14} style={{verticalAlign:'middle',marginRight:4}}/> Бригаде</button>
            </div>

            <div style={{position:'relative', marginBottom:12}}>
              <input 
                list="tr-to-list"
                className="form-input"
                value={trTo} 
                onChange={e=>setTrTo(e.target.value)} 
                placeholder="Выберите кому..."
                style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'10px',fontSize:14,color:'#fff',outline:'none'}}
              />
              <datalist id="tr-to-list">
                <option value="Склад"/>
                {trToType==='worker' ? workersList.map(w=><option key={w} value={w}/>) : brigadesList.map(b=><option key={b} value={b}/>)}
              </datalist>
            </div>

            <div style={{position:'relative', marginBottom:16}}>
              <input 
                list="tr-obj-list"
                className="form-input"
                value={trObj} 
                onChange={e=>setTrObj(e.target.value)} 
                placeholder="На какой объект..."
                style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'10px',fontSize:14,color:'#fff',outline:'none'}}
              />
              <datalist id="tr-obj-list">
                {objectsList.map(o=><option key={o} value={o}/>)}
              </datalist>
            </div>

            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setTransferModal(null)} style={{flex:1,padding:'10px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-muted)',fontWeight:600}}>Отмена</button>
              <button onClick={()=>startTransfer(transferModal)} disabled={!trTo} style={{flex:2,padding:'10px',background:'var(--accent)',border:'none',borderRadius:6,color:'#fff',fontWeight:700,opacity:!trTo?0.5:1}}>Оформить передачу</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPAIR MODAL ── */}
      {repairModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius)',padding:24,width:'100%',maxWidth:400}}>
            <h3 style={{color:'var(--yellow)',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>🛠️ Отправить в ремонт</h3>
            <input placeholder="Название сервисного центра / Куда?" value={repLoc} onChange={e=>setRepLoc(e.target.value)} style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'10px',fontSize:14,color:'#fff',marginBottom:16,outline:'none'}} />
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setRepairModal(null)} style={{flex:1,padding:'10px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-muted)',fontWeight:600}}>Отмена</button>
              <button onClick={()=>sendToRepairClick(repairModal)} disabled={!repLoc} style={{flex:2,padding:'10px',background:'var(--yellow)',border:'none',borderRadius:6,color:'#fff',fontWeight:700,opacity:!repLoc?0.5:1}}>Отправить</button>
            </div>
          </div>
        </div>
      )}

      {/* ── WRITEOFF MODAL ── */}
      {writeoffModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius)',padding:24,width:'100%',maxWidth:400}}>
            <h3 style={{color:'var(--red)',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>🚨 Заявка на списание</h3>
            <textarea placeholder="Опишите, что сломалось и почему..." value={woReason} onChange={e=>setWoReason(e.target.value)} rows={3} style={{width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-light)',borderRadius:6,padding:'10px',fontSize:14,color:'#fff',marginBottom:12,outline:'none',resize:'none'}} />
            
            <div style={{display:'flex',gap:10, marginTop:16}}>
              <button onClick={()=>{setWriteoffModal(null); setWoPhoto(null)}} style={{flex:1,padding:'10px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-muted)',fontWeight:600}}>Отмена</button>
              <button onClick={()=>requestWriteOffClick(writeoffModal)} disabled={!woReason} style={{flex:2,padding:'10px',background:'var(--red)',border:'none',borderRadius:6,color:'#fff',fontWeight:700,opacity:(!woReason)?0.5:1}}>Отправить Админу</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:24,right:24,background:'var(--bg-elevated)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius)',padding:'12px 18px',color:'#fff',fontSize:13,fontWeight:600,zIndex:500,boxShadow:'0 8px 32px rgba(0,0,0,0.4)',display:'flex',alignItems:'center',gap:8}}>
          <Check size={15} color="var(--green)"/> {toast}
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal(p => ({ ...p, isOpen: false }))}
        onConfirm={modal.onConfirm}
      />
    </AppLayout>
  )
}
