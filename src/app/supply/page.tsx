'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import './supply.css'
import {
  Plus, X, ChevronDown, ChevronUp, Send, Paperclip,
  Link2, MessageSquare, Check, Truck, Package,
  Search, ShoppingCart, MapPin, ArrowUpDown,
  Image as ImageIcon, Store, UserCheck,
  ChevronRight, Copy, CheckSquare, Square, AlertCircle,
  BarChart2, Scissors
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getObjects, getDrivers } from '@/actions/common'

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
import { 
  getSupplyOrders, createSupplyOrder, updateSupplyItem, 
  splitSupplyItem, partialPickupSupplyItem, addSupplyComment, bulkAssignSupplyItems,
  Order, MatItem, MComment, MStatus, Priority 
} from '@/actions/supply'

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────
const ALL_STORES = ['Леруа Мерлен Юг', 'Леруа Мерлен Север', 'Петрович', 'ОБИ', 'Castorama', 'Максидом', 'Электромонтаж', 'Метизы СПб', 'Сатурн-Р']

const PRIORITIES = [
  {key:'planned'as Priority, label:'Планово', color:'#22c55e', bg:'rgba(34,197,94,.18)'},
  {key:'urgent' as Priority, label:'Срочно',  color:'#ef4444', bg:'rgba(239,68,68,.18)'},
  {key:'days'   as Priority, label:'1-3 дня', color:'#eab308', bg:'rgba(234,179,8,.18)'},
  {key:'week'   as Priority, label:'Неделя',  color:'#3b82f6', bg:'rgba(59,130,246,.18)'},
]
const MSLABEL: Record<MStatus,string> = {new:'Новый',assigned:'Назначен',picked:'Забрал',delivered:'Доставлено',accepted:'Принято'}
const MSBADGE: Record<MStatus,string> = {new:'badge-gray',assigned:'badge-blue',picked:'badge-orange',delivered:'badge-accent',accepted:'badge-green'}
const PLABEL: Record<Priority,string> = {planned:'Планово', urgent:'Срочно', days:'1-3 дня', week:'Неделя'}
const PBADGE: Record<Priority,string> = {planned:'badge-green', urgent:'badge-red', days:'badge-yellow', week:'badge-blue'}

type ViewMode = 'supply' | 'driver' | 'overview'

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function SupplyPage() {
  const { user } = useAuth()
  const [orders,  setOrders]  = useState<Order[]>([])
  const [view,    setView]    = useState<'supply' | 'driver' | 'overview'>('supply')
  const [search,  setSearch]  = useState('')
  const [stFilter,setStFilter]= useState<'all'|'new'|'assigned'|'picked'>('all')
  const [toast,   setToast]   = useState('')
  const [selectedMids, setSelMids] = useState<Set<string>>(new Set())
  const [bulkStore,   setBulkStore]  = useState('')
  const [bulkDriver,  setBulkDriver] = useState('')
  const [expandedMids,setExpMids]    = useState<Set<string>>(new Set())

  // Dynamic lists
  const [dbObjects, setDbObjects] = useState<string[]>([])
  const [dbDrivers, setDbDrivers] = useState<{name:string}[]>([])

  // Modals
  const [splitModal, setSplitModal] = useState<{mid:string;orderId:string}|null>(null)
  const [splitQty,   setSplitQty]   = useState('')
  const [splitStore, setSplitStore] = useState('')
  const [splitDriver,setSplitDriver]= useState('')
  const [partialModal, setPartModal]= useState<{mid:string;orderId:string;assignedQty:number}|null>(null)
  const [partialQty,   setPartQty]  = useState('')
  const [commentInputs, setCommentInputs] = useState<Record<string,string>>({})

  // New order form
  const [showForm,setShowForm] = useState(false)
  const [fObj,  setFObj]  = useState('')
  const [fPri,  setFPri]  = useState<Priority>('planned')
  const [fItems,setFItems] = useState<{name:string;qty:string;unit:string;note:string}[]>([{name:'',qty:'',unit:'',note:''}])
  const [fExtras,setFExtras]=useState(false)
  const [fComment,setFComment]=useState('')
  const [fLink,  setFLink]  = useState('')
  const [fPhotos, setFPhotos] = useState<string[]>([])
  const photoRef = useRef<HTMLInputElement>(null)

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(''),3500) }
  const nid = () => String(Math.floor(Math.random() * 1000000) + Date.now())

  // ── SERVER DATA SYNC ──
  const loadData = async () => {
    const [ordersData, objs, drvs] = await Promise.all([
      getSupplyOrders(),
      getObjects(),
      getDrivers()
    ])
    setOrders(ordersData)
    setDbObjects(objs)
    setDbDrivers(drvs)
  }

  useEffect(() => { loadData() }, [])

  // ── Helpers ──
  const triggerUpdateItem = async (mid:string, patch:Partial<MatItem>) => {
    setOrders(os=>os.map(o=>({...o,items:o.items.map(m=>m.mid===mid?{...m,...patch}:m)})))
    await updateSupplyItem(mid, patch)
    loadData()
  }

  const addComment = async (orderId:string, mid:string) => {
    const text = (commentInputs[mid]||'').trim()
    if(!text || !user) return
    const id = nid()
    const ts = new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
    
    const nc: MComment = {id, author: user.name, role: user.role || 'Сотрудник', text, ts}
    setOrders(os=>os.map(o=>o.id===orderId?{...o,items:o.items.map(m=>m.mid===mid?{...m,comments:[...m.comments, nc]}:m)}:o))
    setCommentInputs(ci=>({...ci,[mid]:''}))

    await addSupplyComment(mid, id, nc.author, nc.role, nc.text, nc.ts)
    loadData()
  }

  const confirmSplit = async () => {
    if(!splitModal||!splitQty||!splitStore||!splitDriver) return
    const {mid, orderId} = splitModal
    const order = orders.find(o=>o.id===orderId)
    const item  = order?.items.find(m=>m.mid===mid)
    if(!item || !user) return
    const assigned = parseFloat(splitQty)
    const remaining = item.orderedQty - assigned
    if(assigned<=0||remaining<0) return

    if(remaining > 0) {
      const remItem = {
        mid: nid(), name: item.name, orderedQty: remaining, unit: item.unit, note: item.note, parentMid: mid
      }
      await splitSupplyItem(mid, assigned, splitStore, splitDriver, remItem as any)
      
      const ts = new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
      await addSupplyComment(remItem.mid, nid(), user.name, user.role || 'Сотрудник', `Остаток ${remaining} ${item.unit} — требует назначения`, ts)
    } else {
      await updateSupplyItem(mid, { assignedQty: assigned, storeName: splitStore, driver: splitDriver, mStatus: 'assigned' })
    }

    showToast(`Назначено ${assigned} ${item.unit}.` + (remaining>0?` Остаток ${remaining} ${item.unit} — в очереди.`:''))
    setSplitModal(null); setSplitQty(''); setSplitStore(''); setSplitDriver('')
    loadData()
  }

  const confirmPartial = async () => {
    if(!partialModal||!partialQty) return
    const {mid,orderId,assignedQty} = partialModal
    const order  = orders.find(o=>o.id===orderId)
    const item   = order?.items.find(m=>m.mid===mid)
    if(!item || !user) return
    const picked    = parseFloat(partialQty)
    const remaining = assignedQty - picked
    if(picked<=0||remaining<0) return

    if(remaining > 0) {
      const remItem = {
        mid: nid(), name: item.name, orderedQty: remaining, unit: item.unit, note: item.note, parentMid: mid
      }
      await partialPickupSupplyItem(mid, picked, remItem as any)
      
      const ts = new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
      await addSupplyComment(remItem.mid, nid(), user.name, user.role || 'Сотрудник', `Смог взять только ${picked} из ${assignedQty} ${item.unit}. Остаток ${remaining} ${item.unit} вернул в снабжение.`, ts)
      showToast(`Взято ${picked} ${item.unit}. Остаток ${remaining} ${item.unit} возвращён снабжению.`)
    } else {
      await updateSupplyItem(mid, { pickedQty: picked, mStatus: 'picked' })
      showToast(`Взято ${picked} ${item.unit}`)
    }

    setPartModal(null); setPartQty('')
    loadData()
  }

  const toggleExp = (mid:string) => setExpMids(s=>{const n=new Set(s);n.has(mid)?n.delete(mid):n.add(mid);return n})
  const toggleSel = (mid:string) => setSelMids(s=>{const n=new Set(s);n.has(mid)?n.delete(mid):n.add(mid);return n})

  type FlatItem = MatItem & {orderId:string; object:string; priority:Priority; orderLink?:string; orderPhotos?:string[]}
  const allFlat = useMemo(():FlatItem[]=>{
    let list:FlatItem[] = []
    orders.forEach(o=>o.items.forEach(m=>list.push({...m,orderId:o.id,object:o.object,priority:o.priority,orderLink:o.link,orderPhotos:o.photos})))
    if(stFilter==='new')      list = list.filter(i=>i.mStatus==='new')
    if(stFilter==='assigned') list = list.filter(i=>i.mStatus==='assigned')
    if(stFilter==='picked')   list = list.filter(i=>i.mStatus==='picked')
    else if(stFilter==='all') list = list.filter(i=>!['delivered','accepted'].includes(i.mStatus))
    if(search){const q=search.toLowerCase();list=list.filter(i=>i.name.toLowerCase().includes(q)||i.object.toLowerCase().includes(q)||i.orderId.includes(q)||(i.storeName?.toLowerCase().includes(q)??false))}
    return list
  },[orders,stFilter,search])

  const newCount = allFlat.filter(i=>i.mStatus==='new').length
  const allStores = useMemo(()=>{
    const s = new Set<string>([...ALL_STORES])
    orders.forEach(o=>o.items.forEach(m=>{ if(m.storeName) s.add(m.storeName) }))
    return Array.from(s)
  },[orders])

  const applyBulk = async () => {
    if(!bulkStore&&!bulkDriver) return
    const ids = Array.from(selectedMids)
    await bulkAssignSupplyItems(ids, bulkStore||undefined, bulkDriver||undefined)
    showToast(`Назначено ${ids.length} позиций`)
    setSelMids(new Set()); setBulkStore(''); setBulkDriver('')
    loadData()
  }

  const itemsByStore  = useMemo(()=>{
    const m:Record<string,FlatItem[]>={}
    orders.forEach(o=>o.items.forEach(it=>{
      if(it.mStatus==='assigned'&&it.storeName){if(!m[it.storeName])m[it.storeName]=[];m[it.storeName].push({...it,orderId:o.id,object:o.object,priority:o.priority})}
    })); return m
  },[orders])
  const itemsByObj = useMemo(()=>{
    const m:Record<string,FlatItem[]>={}
    orders.forEach(o=>o.items.forEach(it=>{
      if(it.mStatus==='picked'){if(!m[o.object])m[o.object]=[];m[o.object].push({...it,orderId:o.id,object:o.object,priority:o.priority})}
    })); return m
  },[orders])



  const submitOrder = async () => {
    const valid = fItems.filter(m=>m.name.trim())
    if(!fObj || !valid.length || !user) return
    
    const newOrderId = String(Math.floor(Math.random()*900)+100) 
    const newOrder: Omit<Order,'items'> = {
      id: newOrderId, object: fObj, priority: fPri, author: user.name, authorRole: user.role || 'Сотрудник',
      createdAt: new Date().toLocaleDateString('ru-RU').slice(0,10) + ' ' + new Date().toLocaleTimeString('ru-RU').slice(0,5),
      comment: fComment||undefined, link: fLink||undefined, photos: fPhotos.length ? fPhotos : undefined
    }
    const newItems = valid.map(m => ({
      mid: nid(), name: m.name, orderedQty: parseFloat(m.qty)||0, unit: m.unit, note: m.note||undefined, mStatus: 'new' as MStatus 
    }))

    await createSupplyOrder(newOrder, newItems)
    setFObj(''); setFComment(''); setFLink(''); setFPhotos([]); setFItems([{name:'',qty:'',unit:'',note:''}]); setFExtras(false); setShowForm(false)
    showToast(`Заявка создана`)
    loadData()
  }

  const fValid = fItems.filter(m=>m.name.trim())

  const CELL = {padding:'12px 14px',borderBottom:'1px solid var(--border)'}

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header" style={{marginBottom:16}}>
        <h1 style={{color:'#fff'}}>Снабжение</h1>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {newCount>0&&<span className="badge-pill badge-orange">{newCount} без магазина</span>}
          <span className="badge-pill badge-blue">{allFlat.length} активных позиций</span>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(s=>!s)}><Plus size={14}/> Новая заявка</button>
        </div>
      </div>

      {/* NEW ORDER FORM */}
      {showForm&&(
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',marginBottom:20,overflow:'hidden'}}>
          <div style={{background:'var(--bg-elevated)',padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontWeight:800,fontSize:15,color:'#fff'}}>Новая заявка</div><div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:1}}>Укажите объект, приоритет и список</div></div>
            <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer'}}><X size={18}/></button>
          </div>
          <div style={{padding:20}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>📍 Объект</label>
                <select className="form-select" value={fObj} onChange={e=>setFObj(e.target.value)} style={{borderColor:!fObj?'var(--accent)':undefined,color:'#fff'}}>
                  <option value="">Выберите объект...</option>
                  {dbObjects.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>● Приоритет</label>
                <select 
                  value={fPri} 
                  onChange={e=>setFPri(e.target.value as Priority)}
                  style={{
                    width: 'max-content',
                    minWidth: '140px',
                    background: PRIORITIES.find(p => p.key === fPri)?.bg || 'rgba(0,0,0,0.5)',
                    border: `1px solid ${PRIORITIES.find(p => p.key === fPri)?.color || 'rgba(255,255,255,0.2)'}`,
                    color: PRIORITIES.find(p => p.key === fPri)?.color || '#fff',
                    borderRadius: 'var(--radius-sm)',
                    padding: '11px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {PRIORITIES.map(p=>(
                    <option key={p.key} value={p.key} style={{background:'#1a1a2e',color:'#fff'}}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Список материалов</label>
            <datalist id="units-list">
              <option value="шт"/>
              <option value="кг"/>
              <option value="м"/>
              <option value="м²"/>
              <option value="м³"/>
              <option value="л"/>
              <option value="мешков"/>
              <option value="листов"/>
              <option value="упаковок"/>
              <option value="компл"/>
            </datalist>
            {fItems.map((fi,i)=>(
              <div key={i} style={{marginBottom:10,padding:'10px 14px',background:'var(--bg-elevated)',borderRadius:'var(--radius-sm)',border:'1px solid rgba(255,255,255,0.08)'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 90px 80px 32px',gap:8,marginBottom:6}}>
                  <input placeholder="Название материала..." value={fi.name} onChange={e=>setFItems(ms=>ms.map((r,idx)=>idx===i?{...r,name:e.target.value}:r))}
                    style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'9px 12px',fontSize:14,color:'#fff',outline:'none',fontWeight:500}}/>
                  <input placeholder="Кол-во" value={fi.qty} type="number" min="0" onChange={e=>setFItems(ms=>ms.map((r,idx)=>idx===i?{...r,qty:e.target.value}:r))}
                    style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'9px 12px',fontSize:14,color:'#fff',outline:'none',fontWeight:700,textAlign:'right'}}/>
                  <input placeholder="Ед." list="units-list" value={fi.unit} onChange={e=>setFItems(ms=>ms.map((r,idx)=>idx===i?{...r,unit:e.target.value}:r))}
                    style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'9px 10px',fontSize:14,color:'#fff',outline:'none'}}/>
                  {fItems.length>1&&<button onClick={()=>setFItems(ms=>ms.filter((_,idx)=>idx!==i))} style={{width:30,height:36,borderRadius:6,background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>}
                </div>
                <input placeholder="💬 Примечание (марка, стандарт)..." value={fi.note} onChange={e=>setFItems(ms=>ms.map((r,idx)=>idx===i?{...r,note:e.target.value}:r))}
                  style={{width:'100%',background:'transparent',border:'none',borderBottom:'1px dashed rgba(255,255,255,0.1)',padding:'4px 2px',fontSize:12,color:'rgba(255,255,255,0.5)',outline:'none'}}/>
              </div>
            ))}
            <button onClick={()=>setFItems(ms=>[...ms,{name:'',qty:'',unit:'',note:''}])}
              style={{width:'100%',padding:10,background:'transparent',border:'1px dashed rgba(255,255,255,0.15)',borderRadius:'var(--radius-sm)',color:'rgba(255,255,255,0.4)',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <Plus size={14}/> Добавить позицию
            </button>

            {/* Photos + link row */}
            {!fExtras ? (
              <button 
                onClick={()=>setFExtras(true)} 
                style={{width:'100%',padding:10,background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',fontSize:12,cursor:'pointer',marginTop:10,marginBottom:10,textDecoration:'underline'}}>
                + Добавить общее примечание, фото или ссылку
              </button>
            ) : (
              <div style={{background:'rgba(255,255,255,0.02)',border:'1px dashed rgba(255,255,255,0.1)',borderRadius:8,padding:'16px',marginTop:14,marginBottom:14,position:'relative'}}>
                <button onClick={()=>setFExtras(false)} style={{position:'absolute',top:8,right:12,background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:11}}><X size={14}/> Скрыть</button>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:8}}>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>📎 Фото (чек, товар, документ)</label>
                    <div onClick={()=>photoRef.current?.click()} style={{border:'2px dashed rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',cursor:'pointer',background:'rgba(255,255,255,0.04)',minHeight:48,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      {fPhotos.length===0
                        ? <span style={{fontSize:12,color:'rgba(255,255,255,0.3)'}}>+ Добавить фото</span>
                        : fPhotos.map((url,i)=>(
                          <div key={i} style={{position:'relative'}}>
                            <img src={url} alt="" style={{width:56,height:56,objectFit:'cover',borderRadius:6,display:'block'}}/>
                            <button onClick={e=>{e.stopPropagation();setFPhotos(p=>p.filter((_,idx)=>idx!==i))}} style={{position:'absolute',top:2,right:2,width:16,height:16,background:'rgba(0,0,0,0.8)',border:'none',borderRadius:'50%',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}><X size={9}/></button>
                          </div>
                        ))
                      }
                      {fPhotos.length>0&&<div style={{width:40,height:40,border:'1px dashed rgba(255,255,255,0.15)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.3)'}}><Plus size={16}/></div>}
                    </div>
                    <input ref={photoRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>setFPhotos(p=>[...p,...Array.from(e.target.files||[]).map(f=>URL.createObjectURL(f))])}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>🔗 Ссылка на товар</label>
                    <input className="form-input" placeholder="https://leroymerlin.ru/..." value={fLink} onChange={e=>setFLink(e.target.value)} style={{color:'#fff'}}/>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6,marginTop:10}}>💬 Комментарий</label>
                    <input className="form-input" placeholder="Общее уточнение..." value={fComment} onChange={e=>setFComment(e.target.value)} style={{color:'#fff'}}/>
                  </div>
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius-sm)',color:'rgba(255,255,255,0.6)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Отмена</button>
              <button onClick={submitOrder} disabled={!fObj||!fValid.length}
                style={{flex:3,padding:'13px',borderRadius:'var(--radius-sm)',border:'none',background:(!fObj||!fValid.length)?'rgba(255,255,255,0.06)':'var(--accent)',color:(!fObj||!fValid.length)?'rgba(255,255,255,0.2)':'#fff',fontSize:14,fontWeight:800,cursor:(!fObj||!fValid.length)?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:(!fObj||!fValid.length)?'none':'0 4px 16px rgba(201,55,44,0.5)'}}>
                <Send size={16}/> Отправить заявку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPLIT MODAL */}
      {splitModal&&(()=>{
        const o=orders.find(x=>x.id===splitModal.orderId)
        const item=o?.items.find(m=>m.mid===splitModal.mid)
        if(!item) return null
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setSplitModal(null)}>
            <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:28,width:'100%',maxWidth:460}} onClick={e=>e.stopPropagation()}>
              <div style={{fontWeight:800,fontSize:17,color:'#fff',marginBottom:4,display:'flex',alignItems:'center',gap:10}}><Scissors size={18} color="var(--accent)"/> Разделить количество</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:20}}>
                <strong style={{color:'#fff'}}>{item.name}</strong> — заказано <strong style={{color:'var(--accent)'}}>{item.orderedQty} {item.unit}</strong>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>Назначить сейчас</label>
                  <input type="number" min="1" max={item.orderedQty} value={splitQty} onChange={e=>setSplitQty(e.target.value)} placeholder={`Макс. ${item.orderedQty}`}
                    style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 12px',fontSize:16,color:'#fff',fontWeight:800,outline:'none'}}/>
                  {splitQty&&parseFloat(splitQty)<item.orderedQty&&(
                    <div style={{fontSize:12,color:'var(--orange)',marginTop:4}}>⚠️ Остаток {item.orderedQty-parseFloat(splitQty)} {item.unit} вернётся в очередь</div>
                  )}
                </div>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>Ед. измерения</label>
                  <div style={{padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:6,fontSize:16,fontWeight:700,color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.08)'}}>{item.unit}</div>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>Магазин</label>
                <input list="stores-list" value={splitStore} onChange={e=>setSplitStore(e.target.value)} placeholder="Введите магазин..."
                  style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 12px',fontSize:14,color:'#fff',outline:'none'}}/>
                <datalist id="stores-list">{allStores.map(s=><option key={s} value={s}/>)}</datalist>
              </div>
              <div style={{marginBottom:20}}>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>Водитель</label>
                <select value={splitDriver} onChange={e=>setSplitDriver(e.target.value)}
                  style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 12px',fontSize:14,color:'#fff',outline:'none'}}>
                  <option value="">Выберите водителя...</option>
                  {dbDrivers.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setSplitModal(null)} style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius-sm)',color:'rgba(255,255,255,0.6)',fontWeight:600,cursor:'pointer',fontSize:13}}>Отмена</button>
                <button onClick={confirmSplit} disabled={!splitQty||!splitStore||!splitDriver}
                  style={{flex:2,padding:'12px',background:(!splitQty||!splitStore||!splitDriver)?'rgba(255,255,255,0.06)':'var(--accent)',color:(!splitQty||!splitStore||!splitDriver)?'rgba(255,255,255,0.2)':'#fff',border:'none',borderRadius:'var(--radius-sm)',fontWeight:800,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  <Check size={15}/> Назначить
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* PARTIAL PICKUP MODAL */}
      {partialModal&&(()=>{
        const o=orders.find(x=>x.id===partialModal.orderId)
        const item=o?.items.find(m=>m.mid===partialModal.mid)
        if(!item) return null
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setPartModal(null)}>
            <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:28,width:'100%',maxWidth:420}} onClick={e=>e.stopPropagation()}>
              <div style={{fontWeight:800,fontSize:17,color:'#fff',marginBottom:4,display:'flex',alignItems:'center',gap:10}}><Truck size={18} color="var(--blue)"/> Сколько взяли?</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:20}}>
                <strong style={{color:'#fff'}}>{item.name}</strong> — было назначено <strong style={{color:'var(--blue)'}}>{partialModal.assignedQty} {item.unit}</strong>
              </div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>Фактически взял</label>
              <input type="number" min="0" max={partialModal.assignedQty} value={partialQty} onChange={e=>setPartQty(e.target.value)} placeholder={`Макс. ${partialModal.assignedQty}`}
                style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'12px 14px',fontSize:20,color:'#fff',fontWeight:800,outline:'none',marginBottom:8}}/>
              {partialQty&&parseFloat(partialQty)<partialModal.assignedQty&&(
                <div style={{fontSize:13,color:'var(--orange)',marginBottom:16,padding:'8px 12px',background:'rgba(234,179,8,0.1)',borderRadius:6}}>
                  ⚠️ Остаток {partialModal.assignedQty-parseFloat(partialQty)} {item.unit} вернётся снабжению для повторной отправки
                </div>
              )}
              <div style={{display:'flex',gap:10,marginTop:16}}>
                <button onClick={()=>setPartModal(null)} style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius-sm)',color:'rgba(255,255,255,0.6)',fontWeight:600,cursor:'pointer',fontSize:13}}>Отмена</button>
                <button onClick={confirmPartial} disabled={!partialQty||parseFloat(partialQty)<=0}
                  style={{flex:2,padding:'12px',background:(!partialQty||parseFloat(partialQty)<=0)?'rgba(255,255,255,0.06)':'var(--blue)',color:'#fff',border:'none',borderRadius:'var(--radius-sm)',fontWeight:800,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  <Check size={15}/> Подтвердить
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* VIEW TABS */}
      <div style={{display:'flex',gap:0,marginBottom:16,background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',overflow:'hidden'}}>
        {([
          {key:'supply'  as ViewMode, label:'Снабжение', count:allFlat.length},
          {key:'driver'  as ViewMode, label:'Водитель',  count:Object.keys(itemsByStore).length+Object.keys(itemsByObj).length},
          {key:'overview'as ViewMode, label:'Обзор',     count:orders.length},
        ]).map((t,i,arr)=>(
          <button key={t.key} onClick={()=>setView(t.key)} style={{flex:1,padding:'13px 16px',background:view===t.key?'var(--accent)':'transparent',color:view===t.key?'#fff':'rgba(255,255,255,0.5)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13,fontWeight:700,transition:'all .15s',borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.08)':'none'}}>
            {t.label}<span style={{background:view===t.key?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.08)',borderRadius:20,padding:'1px 8px',fontSize:11,fontWeight:700}}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ════ SUPPLY VIEW ════ */}
      {view==='supply'&&(
        <div>
          {/* Toolbar */}
          <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',padding:'12px 16px',marginBottom:12,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{position:'relative',flex:1,minWidth:180}}>
              <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.35)'}}/>
              <input placeholder="Поиск материала, объекта..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius-sm)',padding:'8px 12px 8px 32px',fontSize:13,color:'#fff',outline:'none'}}/>
            </div>
            {(['all','new','assigned','picked'] as const).map(f=>(
              <button key={f} onClick={()=>setStFilter(f)}
                style={{padding:'7px 14px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',border:'1px solid rgba(255,255,255,0.1)',background:stFilter===f?'var(--accent)':'transparent',color:stFilter===f?'#fff':'rgba(255,255,255,0.5)',transition:'all .15s'}}>
                {{all:'Все',new:'Не назначены',assigned:'Назначены',picked:'В пути'}[f]}
              </button>
            ))}
          </div>

          {/* Bulk assign bar */}
          {selectedMids.size>0&&(
            <div style={{background:'rgba(201,55,44,0.12)',border:'1px solid var(--accent)',borderRadius:'var(--radius)',padding:'10px 16px',marginBottom:12,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontWeight:800,color:'var(--accent)',fontSize:13}}>✓ {selectedMids.size} выбрано</span>
              <input list="stores-b" value={bulkStore} onChange={e=>setBulkStore(e.target.value)} placeholder="Магазин..."
                style={{flex:1,minWidth:150,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'7px 12px',fontSize:13,color:'#fff',outline:'none'}}/>
              <datalist id="stores-b">{allStores.map(s=><option key={s} value={s}/>)}</datalist>
              <select value={bulkDriver} onChange={e=>setBulkDriver(e.target.value)}
                style={{minWidth:150,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'7px 12px',fontSize:13,color:'#fff',outline:'none'}}>
                <option value="">Водитель...</option>
                {dbDrivers.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
              <button onClick={applyBulk} disabled={!bulkStore&&!bulkDriver}
                style={{padding:'8px 18px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:6,fontWeight:800,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
                ✓ Назначить всем
              </button>
              <button onClick={()=>{setSelMids(new Set());setBulkStore('');setBulkDriver('')}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer'}}><X size={14}/></button>
            </div>
          )}

          {/* Material rows */}
          <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'10px 16px',background:'rgba(255,255,255,0.04)',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:12}}>
              <button onClick={()=>selectedMids.size===allFlat.length&&allFlat.length>0?setSelMids(new Set()):setSelMids(new Set(allFlat.map(i=>i.mid)))}
                style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600}}>
                {selectedMids.size===allFlat.length&&allFlat.length>0?<CheckSquare size={15} color="var(--accent)"/>:<Square size={15}/>}
                {selectedMids.size>0?`${selectedMids.size} выбрано`:'Выбрать все'}
              </button>
              <span style={{color:'rgba(255,255,255,0.25)'}}>|</span>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Позиций: <strong style={{color:'#fff'}}>{allFlat.length}</strong></span>
              {newCount>0&&<span style={{fontSize:12,color:'var(--orange)'}}>Без магазина: <strong>{newCount}</strong></span>}
            </div>

            {allFlat.map((item,idx)=>{
              const sel = selectedMids.has(item.mid)
              const exp = expandedMids.has(item.mid)
              const qtyColor = item.mStatus==='new'?'rgba(255,255,255,0.3)':item.mStatus==='assigned'?'#3b82f6':item.mStatus==='picked'?'#f97316':'#22c55e'

              const hasAttach = !!(item.orderLink || (item.orderPhotos&&item.orderPhotos.length>0))

              return (
                <div key={item.mid} style={{borderBottom:'1px solid rgba(255,255,255,0.06)',borderLeft:`3px solid ${sel?'var(--accent)':'transparent'}`,background:sel?'rgba(201,55,44,0.06)':item.parentMid?'rgba(234,179,8,0.04)':undefined}}>
                  {/* Main row — layout: checkbox | [name+meta flex-1] | [qty compact] | [compact controls 190px] */}
                  <div style={{display:'flex',alignItems:'stretch',gap:0}}>
                    {/* Checkbox */}
                    <div style={{padding:'16px 10px 16px 14px',display:'flex',alignItems:'center',flexShrink:0}}>
                      <button onClick={()=>toggleSel(item.mid)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',padding:0}}>
                        {sel?<CheckSquare size={16} color="var(--accent)"/>:<Square size={16}/>}
                      </button>
                    </div>

                    {/* Name + meta — takes all available space */}
                    <div style={{flex:1,padding:'14px 10px 14px 4px',minWidth:0}}>
                      {item.parentMid&&<div style={{fontSize:10,color:'var(--orange)',fontWeight:800,letterSpacing:'0.5px',marginBottom:2}}>↩ ОСТАТОК</div>}
                      <div style={{fontSize:16,fontWeight:800,color:'#fff',lineHeight:1.3,marginBottom:4,wordBreak:'break-word'}}>{item.name}</div>
                      {item.note&&<div style={{fontSize:12,color:'rgba(255,255,255,0.5)',fontStyle:'italic',marginBottom:4}}>💬 {item.note}</div>}
                      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                        <span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>#{item.orderId}</span>
                        <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:600}}>{item.object}</span>
                        <span className={PBADGE[item.priority]} style={{fontSize:9}}>{PLABEL[item.priority]}</span>
                        {hasAttach&&<span style={{fontSize:10,color:'#60a5fa',background:'rgba(59,130,246,0.1)',borderRadius:4,padding:'1px 6px',cursor:'pointer'}} onClick={()=>toggleExp(item.mid)}>📎 вложение</span>}
                      </div>
                    </div>

                    {/* Quantity — fixed width, big number */}
                    <div style={{padding:'14px 14px',textAlign:'right',flexShrink:0,display:'flex',flexDirection:'column',justifyContent:'center'}}>
                      <div style={{fontSize:30,fontWeight:900,color:qtyColor,lineHeight:1}}>
                        {item.assignedQty??item.orderedQty}
                      </div>
                      <div style={{fontSize:14,color:'rgba(255,255,255,0.55)',fontWeight:700,marginTop:2}}>{item.unit}</div>
                      {item.assignedQty&&item.assignedQty!==item.orderedQty&&(
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>из {item.orderedQty}</div>
                      )}
                    </div>

                    {/* Compact right controls panel */}
                    <div style={{width:200,flexShrink:0,borderLeft:'1px solid rgba(255,255,255,0.06)',padding:'10px 10px',display:'flex',flexDirection:'column',gap:6,justifyContent:'center'}}>
                      {/* Row 1: status + split + comment */}
                      <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
                        <span className={`badge-pill ${MSBADGE[item.mStatus]}`} style={{fontSize:10,fontWeight:700,flexShrink:0}}>{MSLABEL[item.mStatus]}</span>
                        {['new','assigned'].includes(item.mStatus)&&(
                          <button onClick={()=>{setSplitModal({mid:item.mid,orderId:item.orderId});setSplitQty(String(item.orderedQty));setSplitStore(item.storeName||'');setSplitDriver(item.driver||'')}}
                            title="Разделить количество"
                            style={{padding:'3px 6px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:4,color:'rgba(255,255,255,0.4)',cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontSize:10,fontWeight:600,flexShrink:0}}>
                            <Scissors size={10}/> ÷
                          </button>
                        )}
                        <button onClick={()=>toggleExp(item.mid)}
                          style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:3,background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:4,padding:'3px 7px',color:item.comments.length>0||hasAttach?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.25)',cursor:'pointer',fontSize:11,fontWeight:600}}>
                          <MessageSquare size={11} color={item.comments.length>0?'var(--accent)':hasAttach?'#60a5fa':undefined}/>
                          {item.comments.length>0?item.comments.length:hasAttach?'📎':''}
                          {exp?<ChevronUp size={9}/>:<ChevronDown size={9}/>}
                        </button>
                      </div>
                      {/* Row 2: store compact */}
                      <input list="stores-m" defaultValue={item.storeName||''} placeholder="🏪 Магазин..."
                        onBlur={e=>triggerUpdateItem(item.mid,{storeName:e.target.value,mStatus:e.target.value?(item.mStatus==='new'?'assigned':item.mStatus):'new',assignedQty:item.assignedQty??item.orderedQty})}
                        style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:5,padding:'5px 8px',fontSize:12,color:'rgba(255,255,255,0.85)',outline:'none'}}/>
                      <datalist id="stores-m">{allStores.map(s=><option key={s} value={s}/>)}</datalist>
                      {/* Row 3: driver compact */}
                      <select defaultValue={item.driver||''}
                        onChange={e=>triggerUpdateItem(item.mid,{driver:e.target.value})}
                        style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:5,padding:'5px 8px',fontSize:12,color:'rgba(255,255,255,0.85)',outline:'none'}}>
                        <option value="">🚚 Водитель...</option>
                        {dbDrivers.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Expanded: attachments + comment thread */}
                  {exp&&(
                    <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',marginLeft:30,padding:'14px 16px',background:'rgba(0,0,0,0.25)'}}>
                      {/* Photos and link from order */}
                      {(item.orderPhotos?.length||item.orderLink)&&(
                        <div style={{marginBottom:14,padding:'10px 14px',background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:8}}>
                          <div style={{fontSize:11,fontWeight:700,color:'#60a5fa',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>📎 Вложения к заявке #{item.orderId}</div>
                          {item.orderPhotos&&item.orderPhotos.length>0&&(
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:item.orderLink?8:0}}>
                              {item.orderPhotos.map((url,i)=>(
                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt={`фото ${i+1}`} style={{width:80,height:60,objectFit:'cover',borderRadius:6,border:'1px solid rgba(59,130,246,0.2)',display:'block'}}/>
                                </a>
                              ))}
                            </div>
                          )}
                          {item.orderLink&&(
                            <a href={item.orderLink} target="_blank" rel="noreferrer"
                              style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'#60a5fa',background:'rgba(59,130,246,0.1)',borderRadius:6,padding:'5px 10px',textDecoration:'none'}}>
                              🔗 {item.orderLink.replace(/^https?:\/\/(www\.)?/,'').slice(0,50)}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Comments */}
                      {item.comments.length===0&&<div style={{fontSize:12,color:'rgba(255,255,255,0.25)',marginBottom:8}}>Нет комментариев</div>}
                      {item.comments.map(c=>(
                        <div key={c.id} style={{marginBottom:10,display:'flex',gap:10}}>
                          <div style={{width:30,height:30,borderRadius:'50%',background:'var(--bg-elevated)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.7)',flexShrink:0}}>
                            {c.author.split(' ').map(w=>w[0]).join('').slice(0,2)}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:3}}>
                              <strong style={{color:'rgba(255,255,255,0.75)'}}>{c.author}</strong> · {c.role} · {c.ts}
                            </div>
                            <div style={{fontSize:13,color:'rgba(255,255,255,0.9)',background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'7px 12px',lineHeight:1.5}}>{c.text}</div>
                          </div>
                        </div>
                      ))}
                      <div style={{display:'flex',gap:8,marginTop:10}}>
                        <input placeholder="Написать комментарий (Enter для отправки)..." value={commentInputs[item.mid]||''}
                          onChange={e=>setCommentInputs(ci=>({...ci,[item.mid]:e.target.value}))}
                          onKeyDown={e=>{if(e.key==='Enter')addComment(item.orderId,item.mid)}}
                          style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'9px 14px',fontSize:13,color:'#fff',outline:'none'}}/>
                        <button onClick={()=>addComment(item.orderId,item.mid)} style={{padding:'9px 16px',background:'var(--accent)',border:'none',borderRadius:8,color:'#fff',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:13}}>
                          <Send size={13}/> Отправить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {allFlat.length===0&&<div style={{padding:40,textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:14}}>Нет активных позиций</div>}
          </div>
        </div>
      )}

      {/* ════ DRIVER VIEW ════ */}
      {view==='driver'&&(
        <div style={{display:'grid',gap:16}}>
          {/* Step 1: Забрать */}
          <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',background:'rgba(201,55,44,0.08)',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><div style={{fontWeight:800,fontSize:15,color:'var(--accent)',display:'flex',alignItems:'center',gap:8}}><Store size={16}/> 1 — Забрать из магазинов</div><div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2}}>Нажмите «Забрал» по каждому товару</div></div>
              <span style={{background:'rgba(201,55,44,0.2)',color:'var(--accent)',borderRadius:20,padding:'3px 12px',fontWeight:700,fontSize:12}}>{Object.values(itemsByStore).flat().length} позиций</span>
            </div>
            {Object.keys(itemsByStore).length===0&&<div style={{padding:30,textAlign:'center',color:'rgba(255,255,255,0.3)'}}>Нет товаров для забора</div>}
            {Object.entries(itemsByStore).map(([store,items])=>(
              <div key={store}>
                <div style={{padding:'10px 20px',background:'rgba(201,55,44,0.05)',borderBottom:'1px solid rgba(255,255,255,0.06)',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontWeight:800,fontSize:14,color:'var(--accent)',display:'flex',alignItems:'center',gap:8}}><Store size={14}/>{store}</span>
                  <button onClick={()=>{items.forEach(m=>triggerUpdateItem(m.mid,{mStatus:'picked',pickedQty:m.assignedQty??m.orderedQty}))}}
                    style={{padding:'6px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:20,fontWeight:700,fontSize:12,cursor:'pointer'}}>✓ Забрал всё</button>
                </div>
                {items.map(it=>(
                  <div key={it.mid} style={{padding:'16px 20px 16px 30px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',alignItems:'center',gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:17,fontWeight:800,color:'#fff',marginBottom:4}}>{it.name}</div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',display:'flex',gap:8,alignItems:'center'}}>
                        <span>#{it.orderId}</span><MapPin size={11}/><span style={{color:'rgba(255,255,255,0.6)',fontWeight:600}}>{it.object}</span>
                        <span className={PBADGE[it.priority]} style={{fontSize:10}}>{PLABEL[it.priority]}</span>
                      </div>
                      {it.note&&<div style={{fontSize:12,color:'var(--yellow)',marginTop:4}}>⚠️ {it.note}</div>}
                      {/* Mini chat preview */}
                      {it.comments.length>0&&(
                        <div style={{marginTop:8,fontSize:12,color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.04)',borderRadius:6,padding:'6px 10px'}}>
                          💬 {it.comments[it.comments.length-1].author}: {it.comments[it.comments.length-1].text.slice(0,60)}{it.comments[it.comments.length-1].text.length>60?'...':''}
                        </div>
                      )}
                    </div>
                    <div style={{textAlign:'right',marginRight:8}}>
                      <div style={{fontSize:32,fontWeight:900,color:'#fff',lineHeight:1}}>{it.assignedQty??it.orderedQty}</div>
                      <div style={{fontSize:14,color:'rgba(255,255,255,0.5)',fontWeight:700}}>{it.unit}</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
                      <button onClick={()=>{setPartModal({mid:it.mid,orderId:it.orderId,assignedQty:it.assignedQty??it.orderedQty});setPartQty(String(it.assignedQty??it.orderedQty))}}
                        style={{padding:'11px 18px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:'var(--radius-sm)',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
                        <Check size={15}/> Забрал
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Step 2: Завезти */}
          <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',background:'rgba(59,130,246,0.08)',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><div style={{fontWeight:800,fontSize:15,color:'#60a5fa',display:'flex',alignItems:'center',gap:8}}><Truck size={16}/> 2 — Завезти на объекты</div><div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2}}>Нажмите «Завёз» после доставки</div></div>
              <span style={{background:'rgba(59,130,246,0.15)',color:'#60a5fa',borderRadius:20,padding:'3px 12px',fontWeight:700,fontSize:12}}>{Object.values(itemsByObj).flat().length} позиций</span>
            </div>
            {Object.keys(itemsByObj).length===0&&<div style={{padding:30,textAlign:'center',color:'rgba(255,255,255,0.3)'}}>Нет товаров для доставки</div>}
            {Object.entries(itemsByObj).map(([obj,items])=>(
              <div key={obj}>
                <div style={{padding:'10px 20px',background:'rgba(59,130,246,0.05)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontWeight:800,fontSize:14,color:'#60a5fa',display:'flex',alignItems:'center',gap:8}}><MapPin size={14}/>{obj}</span>
                  <button onClick={()=>{items.forEach(m=>triggerUpdateItem(m.mid,{mStatus:'delivered'}))}}
                    style={{padding:'6px 14px',background:'#2563eb',color:'#fff',border:'none',borderRadius:20,fontWeight:700,fontSize:12,cursor:'pointer'}}>✓ Завёз всё</button>
                </div>
                {items.map(it=>(
                  <div key={it.mid} style={{padding:'14px 20px 14px 30px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',alignItems:'center',gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:17,fontWeight:800,color:'#fff',marginBottom:2}}>{it.name}</div>
                      {it.note&&<div style={{fontSize:12,color:'var(--yellow)'}}>⚠️ {it.note}</div>}
                    </div>
                    <div style={{textAlign:'right',marginRight:8}}>
                      <div style={{fontSize:32,fontWeight:900,color:'#fff',lineHeight:1}}>{it.pickedQty??it.assignedQty??it.orderedQty}</div>
                      <div style={{fontSize:14,color:'rgba(255,255,255,0.5)',fontWeight:700}}>{it.unit}</div>
                    </div>
                    <button onClick={()=>triggerUpdateItem(it.mid,{mStatus:'delivered'})}
                      style={{padding:'11px 18px',background:'#2563eb',color:'#fff',border:'none',borderRadius:'var(--radius-sm)',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',flexShrink:0}}>
                      <MapPin size={14}/> Завёз
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ OVERVIEW ════ */}
      {view==='overview'&&(
        <div style={{background:'var(--bg-surface)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'var(--radius)',overflow:'hidden'}}>
          {orders.map(order=>(
            <div key={order.id} style={{borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'16px 20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                <span style={{fontWeight:800,fontSize:13,color:'rgba(255,255,255,0.4)'}}> #{order.id}</span>
                <span style={{fontWeight:700,fontSize:16,color:'#fff'}}>{order.object}</span>
                <span className={PBADGE[order.priority]}>{PLABEL[order.priority]}</span>
                <span style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginLeft:'auto'}}>{order.author} · {order.createdAt}</span>
              </div>
              <div style={{display:'grid',gap:6}}>
                {order.items.map(m=>(
                  <div key={m.mid} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'rgba(255,255,255,0.04)',borderRadius:6}}>
                    <span className={`badge-pill ${MSBADGE[m.mStatus]}`} style={{fontSize:10,flexShrink:0}}>{MSLABEL[m.mStatus]}</span>
                    <span style={{flex:1,fontSize:14,fontWeight:600,color:'#fff'}}>{m.name}</span>
                    <span style={{fontSize:16,fontWeight:900,color:'#fff'}}>{m.assignedQty??m.orderedQty} <span style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.4)'}}>{m.unit}</span></span>
                    {m.storeName&&<span style={{fontSize:12,color:'#3b82f6',background:'rgba(59,130,246,0.1)',borderRadius:4,padding:'2px 8px'}}>{m.storeName}</span>}
                    {m.driver&&<span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>🚚 {m.driver}</span>}
                    {m.comments.length>0&&<MessageSquare size={14} color="var(--accent)"/>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast&&<div className="toast"><Package size={15}/> {toast}</div>}
    </AppLayout>
  )
}
