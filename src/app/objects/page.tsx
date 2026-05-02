'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { 
  Building2, Search, MapPin, HardHat, Wrench, ShoppingCart, 
  Plus, X, Trash, Users, Store, Edit, Phone, UserPlus, Download
} from 'lucide-react'
import { getObjects, getWorkers, getStores, getBrigades } from '@/actions/common'
import { 
  addObject, deleteObject, updateObject,
  addBrigade, updateBrigade, deleteBrigade, setWorkerBrigade,
  addStore, updateStore, deleteStore 
} from '@/actions/admin'
import { exportDirectoriesExcel } from '@/actions/export'
import { useAuth } from '@/components/AuthProvider'
import Modal from '@/components/Modal'

type TabType = 'objects' | 'brigades' | 'stores'

export default function ObjectsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Админ'

  const [activeTab, setActiveTab] = useState<TabType>('objects')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Data States
  const [objects, setObjects] = useState<string[]>([])
  const [brigades, setBrigades] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [workers, setWorkers] = useState<any[]>([])

  // Modal States
  const [showAdd, setShowAdd] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [managingMembers, setManagingMembers] = useState<any>(null)
  const [modal, setModal] = useState<{
    isOpen: boolean, 
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'danger' | 'warning',
    onConfirm?: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    pot_amount: 0
  })

  useEffect(() => {
    refreshData()
  }, [activeTab])

  const refreshData = async () => {
    setLoading(true)
    if (activeTab === 'objects') {
      const data = await getObjects()
      setObjects(data)
    } else if (activeTab === 'brigades') {
      const bData = await getBrigades()
      const wData = await getWorkers()
      setBrigades(bData)
      setWorkers(wData)
    } else if (activeTab === 'stores') {
      const sData = await getStores()
      setStores(sData)
    }
    setLoading(false)
  }

  // ── HANDLERS ─────────────────────────────────────────────

  const handleOpenAdd = () => {
    setFormData({ name: '', address: '', phone: '', pot_amount: 0 })
    setShowAdd(true)
  }

  const handleOpenEdit = (item: any) => {
    if (activeTab === 'objects') {
      setFormData({ name: item, address: '', phone: '', pot_amount: 0 })
    } else if (activeTab === 'brigades') {
      setFormData({ name: item.name, address: '', phone: '', pot_amount: item.pot_amount || 0 })
    } else if (activeTab === 'stores') {
      setFormData({ name: item.name, address: item.address || '', phone: item.phone || '', pot_amount: 0 })
    }
    setEditingItem(item)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    let res: any

    if (editingItem) {
      if (activeTab === 'objects') res = await updateObject(editingItem, formData.name)
      else if (activeTab === 'brigades') res = await updateBrigade(editingItem.id, formData.name, formData.pot_amount)
      else if (activeTab === 'stores') res = await updateStore(editingItem.id, formData.name, formData.address, formData.phone)
    } else {
      if (activeTab === 'objects') res = await addObject(formData.name)
      else if (activeTab === 'brigades') res = await addBrigade(formData.name)
      else if (activeTab === 'stores') res = await addStore(formData.name, formData.address, formData.phone)
    }

    if (res?.success) {
      setShowAdd(false)
      setEditingItem(null)
      refreshData()
      setModal({
        isOpen: true,
        title: 'Успех',
        message: editingItem ? 'Изменения сохранены' : 'Запись добавлена',
        type: 'success'
      })
    } else {
      setModal({
        isOpen: true,
        title: 'Ошибка',
        message: res?.error || 'Произошла ошибка при сохранении',
        type: 'danger'
      })
    }
    setLoading(false)
  }

  const handleDelete = async (idOrName: string) => {
    setModal({
      isOpen: true,
      title: 'Подтверждение',
      message: 'Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить.',
      type: 'warning',
      onConfirm: async () => {
        let res: any
        if (activeTab === 'objects') res = await deleteObject(idOrName)
        else if (activeTab === 'brigades') res = await deleteBrigade(idOrName)
        else if (activeTab === 'stores') res = await deleteStore(idOrName)

        if (res?.success) {
          refreshData()
          setModal(prev => ({ ...prev, isOpen: false }))
        } else {
          setModal({
            isOpen: true,
            title: 'Ошибка',
            message: res?.error || 'Не удалось удалить запись',
            type: 'danger'
          })
        }
      }
    })
  }

  const handleExport = async () => {
    const res = await exportDirectoriesExcel()
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

  const toggleWorkerInBrigade = async (workerId: string, currentBrigadeId: string | null) => {
    const newBrigadeId = currentBrigadeId === managingMembers.id ? null : managingMembers.id
    const res = await setWorkerBrigade(workerId, newBrigadeId)
    if (res.success) {
      const updatedWorkers = await getWorkers()
      setWorkers(updatedWorkers)
    } else {
      setModal({
        isOpen: true,
        title: 'Ошибка',
        message: res.error || 'Ошибка при управлении участниками',
        type: 'danger'
      })
    }
  }

  // ── FILTERS ─────────────────────────────────────────────
  const filtered = activeTab === 'objects' 
    ? objects.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : activeTab === 'brigades'
    ? brigades.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : stores.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  const TAB_CONFIG = [
    { id: 'objects', label: 'Объекты', icon: Building2, color: 'var(--accent)' },
    { id: 'brigades', label: 'Бригады', icon: Users, color: 'var(--green)' },
    { id: 'stores', label: 'Магазины', icon: Store, color: 'var(--blue)' },
  ]

  return (
    <AppLayout>
      <div className="page-header" style={{marginBottom:16}}>
        <div>
          <h1 style={{color:'#fff', marginBottom:4}}>Справочники системы</h1>
          <p style={{color:'rgba(255,255,255,0.4)', fontSize:12, margin:0}}>Управление объектами, командами и поставщиками</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)'}} onClick={handleExport}>
              <Download size={14}/> Экспорт
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
              <Plus size={14}/> Добавить {activeTab === 'objects' ? 'объект' : activeTab === 'brigades' ? 'бригаду' : 'магазин'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:8, marginBottom:20, background:'rgba(255,255,255,0.03)', padding:4, borderRadius:12, border:'1px solid var(--border)'}}>
        {TAB_CONFIG.map(tab => (
          <button 
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as TabType); setSearch('') }}
            style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              padding:'10px', borderRadius:8, border:'none', fontSize:13, fontWeight:700,
              cursor:'pointer', transition:'all 0.2s',
              background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab.id ? tab.color : 'rgba(255,255,255,0.4)',
              boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
            }}
          >
            <tab.icon size={16}/>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{position:'relative', width:'100%', marginBottom:20}}>
        <Search size={16} style={{position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)'}}/>
        <input 
          placeholder={`Поиск в разделе ${TAB_CONFIG.find(t=>t.id===activeTab)?.label}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{width:'100%', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px 12px 42px', color:'#fff', outline:'none'}}
        />
      </div>

      {/* Content List */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'rgba(255,255,255,0.03)', borderBottom:'1px solid var(--border)'}}>
              <th style={{padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontSize:11, textTransform:'uppercase'}}>Наименование</th>
              {activeTab === 'brigades' && <th style={{padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontSize:11, textTransform:'uppercase'}}>Участников</th>}
              {activeTab === 'stores' && <th style={{padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontSize:11, textTransform:'uppercase'}}>Контакты</th>}
              <th style={{padding:'12px 16px', textAlign:'right', color:'rgba(255,255,255,0.4)', fontSize:11, textTransform:'uppercase'}}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => {
              const name = activeTab === 'objects' ? item : item.name
              const id = activeTab === 'objects' ? item : item.id
              return (
                <tr key={idx} style={{borderBottom:'1px solid var(--border)', transition:'background 0.2s'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'14px 16px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:12}}>
                      <div style={{width:32, height:32, borderRadius:8, background: activeTab==='objects'?'var(--accent-dim)':activeTab==='brigades'?'var(--green-dim)':'var(--blue-dim)', color: activeTab==='objects'?'var(--accent)':activeTab==='brigades'?'var(--green)':'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        {activeTab === 'objects' ? <MapPin size={16}/> : activeTab === 'brigades' ? <Users size={16}/> : <Store size={16}/>}
                      </div>
                      <span style={{fontWeight:600, color:'#fff'}}>{name}</span>
                    </div>
                  </td>
                  
                  {activeTab === 'brigades' && (
                    <td style={{padding:'14px 16px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:6, color:'rgba(255,255,255,0.6)', fontSize:13}}>
                        <Users size={14}/> {workers.filter(w => w.brigade_id === item.id).length} чел.
                      </div>
                    </td>
                  )}

                  {activeTab === 'stores' && (
                    <td style={{padding:'14px 16px'}}>
                      <div style={{fontSize:12}}>
                        <div style={{color:'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', gap:6}}><MapPin size={10}/> {item.address || '—'}</div>
                        <div style={{color:'var(--blue)', display:'flex', alignItems:'center', gap:6, marginTop:2}}><Phone size={10}/> {item.phone || '—'}</div>
                      </div>
                    </td>
                  )}

                  <td style={{padding:'14px 16px', textAlign:'right'}}>
                    <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                      {activeTab === 'brigades' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setManagingMembers(item) }} 
                          title="Управление участниками" 
                          style={{width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, color:'var(--green)', transition:'all 0.2s', cursor:'pointer'}}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--green)'; e.currentTarget.style.color='#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='rgba(34,197,94,0.1)'; e.currentTarget.style.color='var(--green)'; }}
                        >
                          <UserPlus size={14}/>
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(item) }} 
                        title="Редактировать"
                        style={{width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, color:'#3b82f6', transition:'all 0.2s', cursor:'pointer'}}
                        onMouseEnter={e => { e.currentTarget.style.background='#3b82f6'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(59,130,246,0.1)'; e.currentTarget.style.color='#3b82f6'; }}
                      >
                        <Edit size={14}/>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(id) }} 
                        title="Удалить"
                        style={{width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, color:'var(--red)', transition:'all 0.2s', cursor:'pointer'}}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--red)'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='var(--red)'; }}
                      >
                        <Trash size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{padding:40, textAlign:'center', color:'rgba(255,255,255,0.2)'}}>
            <Search size={40} style={{marginBottom:12, opacity:0.5}}/>
            <div>Ничего не найдено</div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(showAdd || editingItem) && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <form onSubmit={handleSubmit} style={{width:'100%', maxWidth:450, background:'var(--bg-surface)', borderRadius:20, border:'1px solid var(--border)', overflow:'hidden'}}>
            <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h2 style={{margin:0, fontSize:18, fontWeight:800, color:'#fff'}}>{editingItem ? 'Редактировать' : 'Добавить'} {activeTab==='objects'?'объект':activeTab==='brigades'?'бригаду':'магазин'}</h2>
              <button type="button" onClick={() => {setShowAdd(false); setEditingItem(null)}} style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer'}}><X size={20}/></button>
            </div>
            <div style={{padding:24, display:'flex', flexDirection:'column', gap:16}}>
              <div>
                <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8}}>НАИМЕНОВАНИЕ</label>
                <input required autoFocus value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:10, padding:12, color:'#fff', outline:'none'}}/>
              </div>

              {activeTab === 'stores' && (
                <>
                  <div>
                    <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8}}>АДРЕС</label>
                    <input value={formData.address} onChange={e=>setFormData({...formData, address:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:10, padding:12, color:'#fff', outline:'none'}}/>
                  </div>
                  <div>
                    <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8}}>ТЕЛЕФОН</label>
                    <input value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:10, padding:12, color:'#fff', outline:'none'}}/>
                  </div>
                </>
              )}

              {activeTab === 'brigades' && (
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8}}>ОБЩАК (₽)</label>
                  <input type="number" value={formData.pot_amount} onChange={e=>setFormData({...formData, pot_amount: parseInt(e.target.value)||0})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:10, padding:12, color:'#fff', outline:'none'}}/>
                </div>
              )}

              <div style={{display:'flex', gap:12, marginTop:8}}>
                <button type="button" onClick={() => {setShowAdd(false); setEditingItem(null)}} style={{flex:1, padding:14, background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:12, color:'rgba(255,255,255,0.6)', fontWeight:700, cursor:'pointer'}}>ОТМЕНА</button>
                <button type="submit" disabled={loading} style={{flex:2, padding:14, background:'var(--accent)', border:'none', borderRadius:12, color:'#fff', fontWeight:800, cursor:'pointer', opacity:loading?0.7:1}}>СОХРАНИТЬ</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Member Management Modal */}
      {managingMembers && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div style={{width:'100%', maxWidth:500, background:'var(--bg-surface)', borderRadius:24, border:'1px solid var(--border)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column'}}>
            <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <h2 style={{margin:0, fontSize:18, fontWeight:800, color:'#fff'}}>Участники бригады</h2>
                <div style={{fontSize:12, color:'var(--green)', fontWeight:600}}>{managingMembers.name}</div>
              </div>
              <button onClick={() => setManagingMembers(null)} style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer'}}><X size={20}/></button>
            </div>
            
            <div style={{padding:16, overflowY:'auto'}}>
               <div style={{display:'flex', flexDirection:'column', gap:8}}>
                 {workers.map(w => {
                   const isInThis = w.brigade_id === managingMembers.id
                   const isInOther = w.brigade_id && w.brigade_id !== managingMembers.id
                   return (
                     <div key={w.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:isInThis ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)', borderRadius:12, border: isInThis ? '1px solid rgba(34,197,94,0.2)' : '1px solid transparent'}}>
                        <div style={{display:'flex', alignItems:'center', gap:10}}>
                           <div style={{width:32, height:32, borderRadius:8, background:w.user_color||'var(--accent)', color:'#fff', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center'}}>
                             {w.initials}
                           </div>
                           <div>
                             <div style={{fontSize:14, fontWeight:700, color:'#fff'}}>{`${w.last_name || ''} ${w.first_name || ''} ${w.patronymic || ''}`.trim() || w.name}</div>
                             <div style={{fontSize:11, color:isInOther ? 'var(--red)' : 'rgba(255,255,255,0.3)'}}>
                                {isInOther ? `В бригаде: ${brigades.find(b=>b.id===w.brigade_id)?.name || w.brigade_id}` : (w.role || 'Рабочий')}
                             </div>
                           </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => toggleWorkerInBrigade(w.id, w.brigade_id)}
                          style={{
                            padding:'6px 12px', borderRadius:8, border:'none', fontSize:11, fontWeight:800, cursor:'pointer',
                            background: isInThis ? 'var(--red)' : 'var(--green)',
                            color: '#fff',
                            opacity: isInOther ? 0.4 : 1
                          }}
                        >
                          {isInThis ? 'УБРАТЬ' : 'ДОБАВИТЬ'}
                        </button>
                     </div>
                   )
                 })}
               </div>
            </div>
            
            <div style={{padding:20, borderTop:'1px solid var(--border)', background:'rgba(255,255,255,0.02)'}}>
               <button onClick={() => setManagingMembers(null)} style={{width:'100%', padding:12, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:12, color:'#fff', fontWeight:700, cursor:'pointer'}}>ГOTОВО</button>
            </div>
          </div>
        </div>
      )}
      <Modal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modal.onConfirm}
        showConfirm={!!modal.onConfirm}
        confirmText="Да, удалить"
        cancelText={modal.onConfirm ? "Отмена" : "Закрыть"}
      />
    </AppLayout>
  )
}
