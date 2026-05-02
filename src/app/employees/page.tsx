'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { Users, Search, Ruler, Shirt, Footprints, Mail, Phone, MapPin, MoreHorizontal, Edit, Check, X, Trash, Download, Lock, Unlock, Filter, AlertTriangle } from 'lucide-react'
import { getWorkers } from '@/actions/common'
import { getBrigades } from '@/actions/tabel'
import { updateWorkerAdmin, deleteWorker, toggleWorkerBlock } from '@/actions/admin'
import { exportEmployeesExcel } from '@/actions/export'
import { useAuth } from '@/components/AuthProvider'

export default function EmployeesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Админ'

  const [workers, setWorkers] = useState<any[]>([])
  const [brigades, setBrigades] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [brigadeFilter, setBrigadeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, active, blocked
  const [loading, setLoading] = useState(true)

  // Edit Modal State
  const [editingWorker, setEditingWorker] = useState<any | null>(null)
  const [deleteConfirmWorker, setDeleteConfirmWorker] = useState<{id:string, name:string} | null>(null)
  const [editForm, setEditForm] = useState({
    last_name: '',
    first_name: '',
    patronymic: '',
    role: '',
    brigade_id: '',
    height: '',
    clothing_size: '',
    shoe_size: ''
  })

  useEffect(() => {
    refreshData()
    getBrigades().then(setBrigades)
  }, [])

  const refreshData = async () => {
    setLoading(true)
    const data = await getWorkers()
    setWorkers(data)
    setLoading(false)
  }

  const handleEditClick = (w: any) => {
    setEditingWorker(w)
    setEditForm({
      last_name: w.last_name || '',
      first_name: w.first_name || '',
      patronymic: w.patronymic || '',
      role: w.role || '',
      brigade_id: w.brigade_id || '',
      height: w.height?.toString() || '',
      clothing_size: w.clothing_size || '',
      shoe_size: w.shoe_size?.toString() || ''
    })
  }

  const handleSave = async () => {
    if (!editingWorker) return
    const res = await updateWorkerAdmin(editingWorker.id, {
      ...editForm,
      height: editForm.height ? parseInt(editForm.height) : null,
      brigade_id: editForm.brigade_id || null
    })
    if (res.success) {
      setEditingWorker(null)
      refreshData()
    } else {
      alert(res.error)
    }
  }

  const handleDelete = async () => {
    if (!editingWorker || !confirm(`Удалить сотрудника ${editingWorker.name}?`)) return
    const res = await deleteWorker(editingWorker.id)
    if (res.success) {
      setEditingWorker(null)
      refreshData()
    } else {
      alert(res.error)
    }
  }

  const confirmDeleteDirect = (id: string, name: string) => {
    setDeleteConfirmWorker({ id, name })
  }

  const handleConfirmedDelete = async () => {
    if (!deleteConfirmWorker) return
    const res = await deleteWorker(deleteConfirmWorker.id)
    if (res.success) {
      setDeleteConfirmWorker(null)
      refreshData()
    } else {
      alert(res.error)
    }
  }

  const handleToggleBlock = async (id: string) => {
    const res = await toggleWorkerBlock(id)
    if (res.success) {
      refreshData()
    } else {
      alert(res.error)
    }
  }

  const handleExport = async () => {
    const res = await exportEmployeesExcel()
    if (res.success) {
      const link = document.createElement('a')
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`
      link.download = res.fileName
      link.click()
    }
  }

  const filtered = workers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) || (w.login && w.login.toLowerCase().includes(search.toLowerCase()))
    const matchesRole = !roleFilter || w.role === roleFilter
    const matchesBrigade = !brigadeFilter || w.brigade_id === brigadeFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && !w.is_blocked) || (statusFilter === 'blocked' && w.is_blocked)
    return matchesSearch && matchesRole && matchesBrigade && matchesStatus
  })

  // Специфические роли для проекта
  const roles = ['Админ', 'Мастер', 'Бригадир', 'Склад', 'Водитель', 'Бетонщик', 'Отделочник', 'Подсобник', 'Рабочий', 'Геодезист', 'Охрана']

  const stats = {
    total: workers.length,
    active: workers.filter(w=>!w.is_blocked).length,
    blocked: workers.filter(w=>w.is_blocked).length,
    byRole: workers.reduce((acc, w) => { acc[w.role] = (acc[w.role] || 0) + 1; return acc }, {} as any)
  }

  return (
    <AppLayout>
      <div className="page-header" style={{marginBottom:24}}>
        <h1 style={{color:'#fff', display:'flex', alignItems:'center', gap:10}}>
          <Users size={24} color="var(--accent)"/> Сотрудники
        </h1>
        <div style={{position:'relative', width:'100%', maxWidth:350}}>
          <Search size={16} style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)'}}/>
          <input 
            placeholder="Поиск по имени или должности..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{
              width:'100%', background:'var(--bg-surface)', border:'1px solid var(--border)', 
              borderRadius:10, padding:'10px 14px 10px 40px', color:'#fff', outline:'none'
            }}
          />
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:20}}>
        <div style={{background:'var(--bg-surface)', padding:12, borderRadius:12, border:'1px solid var(--border)'}}>
           <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', marginBottom:4}}>Всего</div>
           <div style={{fontSize:24, fontWeight:900, color:'#fff'}}>{stats.total}</div>
        </div>
        <div style={{background:'var(--bg-surface)', padding:12, borderRadius:12, border:'1px solid var(--border)'}}>
           <div style={{fontSize:11, color:'var(--green)', fontWeight:700, textTransform:'uppercase', marginBottom:4}}>Активны</div>
           <div style={{fontSize:24, fontWeight:900, color:'var(--green)'}}>{stats.active}</div>
        </div>
        <div style={{background:'var(--bg-surface)', padding:12, borderRadius:12, border:'1px solid var(--border)'}}>
           <div style={{fontSize:11, color:'var(--red)', fontWeight:700, textTransform:'uppercase', marginBottom:4}}>Блок</div>
           <div style={{fontSize:24, fontWeight:900, color:'var(--red)'}}>{stats.blocked}</div>
        </div>
        <div style={{background:'var(--bg-surface)', padding:12, borderRadius:12, border:'1px solid var(--border)', cursor:'pointer'}} onClick={handleExport}>
           <div style={{fontSize:11, color:'var(--accent)', fontWeight:700, textTransform:'uppercase', marginBottom:4}}>Экспорт</div>
           <div style={{fontSize:18, fontWeight:900, color:'var(--accent)', display:'flex', alignItems:'center', gap:8}}><Download size={18}/> Excel</div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div style={{background:'var(--bg-surface)', padding:16, borderRadius:12, border:'1px solid var(--border)', marginBottom:20, display:'flex', flexWrap:'wrap', gap:12, alignItems:'center'}}>
        <div style={{position:'relative', flex:2, minWidth:200}}>
          <Search size={14} style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)'}}/>
          <input 
            placeholder="Поиск по ФИО или логину..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px 8px 36px', color:'#fff', outline:'none', fontSize:13}}
          />
        </div>
        <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{flex:1, minWidth:120, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px', color:'#fff', outline:'none', fontSize:13}}>
          <option value="">Все роли</option>
          {roles.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <select value={brigadeFilter} onChange={e=>setBrigadeFilter(e.target.value)} style={{flex:1, minWidth:120, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px', color:'#fff', outline:'none', fontSize:13}}>
          <option value="">Все бригады</option>
          {brigades.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{flex:1, minWidth:120, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px', color:'#fff', outline:'none', fontSize:13}}>
          <option value="all">Любой статус</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </select>
      </div>

      {/* ── Employees List (Table Style) ── */}
      <div style={{background:'var(--bg-surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:40, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:14}}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{padding:40, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:14}}>Сотрудники не найдены</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{background:'rgba(255,255,255,0.03)', borderBottom:'1px solid var(--border)'}}>
                  <th style={{padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', fontSize:11}}>Сотрудник</th>
                  <th style={{padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', fontSize:11}}>Роль</th>
                  <th style={{padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', fontSize:11}}>Объект/Бригада</th>
                  <th style={{padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', fontSize:11}}>Размеры</th>
                  <th style={{padding:'12px 16px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', fontSize:11}}>Статус</th>
                  <th style={{padding:'12px 16px', textAlign:'right', color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', fontSize:11}}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id} style={{borderBottom:'1px solid var(--border)', transition:'background 0.2s', opacity: w.is_blocked ? 0.6 : 1}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'12px 16px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <div style={{width:32, height:32, borderRadius:8, background:w.user_color||'var(--accent)', color:'#fff', fontSize:12, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center'}}>
                          {w.initials || w.name[0]}
                        </div>
                        <div>
                          <div style={{fontWeight:700, color:'#fff'}}>{w.name}</div>
                          <div style={{fontSize:11, color:'rgba(255,255,255,0.3)'}}>{w.login ? `${w.login}` : 'нет логина'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px'}}>
                      <span style={{padding:'4px 8px', borderRadius:6, background: w.user_color ? `${w.user_color}22` : 'rgba(255,255,255,0.05)', color:w.user_color||'var(--accent)', fontSize:11, fontWeight:800, textTransform:'uppercase', border:`1px solid ${w.user_color}33`}}>
                        {w.role}
                      </span>
                    </td>
                    <td style={{padding:'12px 16px', color:'rgba(255,255,255,0.6)'}}>
                      <div style={{display:'flex', alignItems:'center', gap:6}}>
                        <MapPin size={12} style={{flexShrink:0}}/>
                        <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:150}}>
                          {w.brigade_id ? (brigades.find(b=>b.id===w.brigade_id)?.name || w.brigade_id) : '—'}
                        </span>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px'}}>
                      <div style={{display:'flex', gap:8, fontSize:11}}>
                        <span style={{color:'rgba(255,255,255,0.4)'}}><Shirt size={10} style={{marginRight:2}}/>{w.clothing_size||'—'}</span>
                        <span style={{color:'rgba(255,255,255,0.4)'}}><Footprints size={10} style={{marginRight:2}}/>{w.shoe_size||'—'}</span>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px', textAlign:'center'}}>
                      {w.is_blocked ? (
                        <div style={{display:'inline-flex', alignItems:'center', gap:4, color:'var(--red)', background:'rgba(239,68,68,0.1)', padding:'4px 8px', borderRadius:20, fontSize:10, fontWeight:700}}>
                          <Lock size={10}/> БЛОК
                        </div>
                      ) : (
                        <div style={{display:'inline-flex', alignItems:'center', gap:4, color:'var(--green)', background:'rgba(34,197,94,0.1)', padding:'4px 8px', borderRadius:20, fontSize:10, fontWeight:700}}>
                          <Check size={10}/> РАБОТАЕТ
                        </div>
                      )}
                    </td>
                    <td style={{padding:'12px 16px', textAlign:'right'}}>
                      <div style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
                        {isAdmin && (
                          <>
                            <button onClick={()=>handleEditClick(w)} style={{width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'rgba(255,255,255,0.6)', cursor:'pointer'}}>
                              <Edit size={14}/>
                            </button>
                            <button onClick={()=>handleToggleBlock(w.id)} style={{width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:w.is_blocked?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', border:w.is_blocked?'1px solid rgba(34,197,94,0.2)':'1px solid rgba(239,68,68,0.2)', borderRadius:6, color:w.is_blocked?'var(--green)':'var(--red)', cursor:'pointer'}}>
                              {w.is_blocked ? <Unlock size={14}/> : <Lock size={14}/>}
                            </button>
                            <button onClick={() => confirmDeleteDirect(w.id, w.name)} style={{width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.1)', borderRadius:6, color:'rgba(239,68,68,0.4)', cursor:'pointer'}}>
                              <Trash size={14}/>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingWorker && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div style={{width:'100%', maxWidth:500, background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'0 20px 50px rgba(0,0,0,0.5)'}}>
            <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h2 style={{margin:0, fontSize:18, fontWeight:800, color:'#fff'}}>Редактирование сотрудника</h2>
              <button onClick={() => setEditingWorker(null)} style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer'}}><X size={20}/></button>
            </div>
            
            <div style={{padding:24, display:'flex', flexDirection:'column', gap:16}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6}}>ФАМИЛИЯ</label>
                  <input value={editForm.last_name} onChange={e=>setEditForm({...editForm, last_name:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:10, color:'#fff', outline:'none'}}/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6}}>ИМЯ</label>
                  <input value={editForm.first_name} onChange={e=>setEditForm({...editForm, first_name:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:10, color:'#fff', outline:'none'}}/>
                </div>
              </div>

              <div>
                <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6}}>РОЛЬ</label>
                <select value={editForm.role} onChange={e=>setEditForm({...editForm, role:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:10, color:'#fff', outline:'none'}}>
                  {roles.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6}}>БРИГАДА / ОБЪЕКТ</label>
                <select value={editForm.brigade_id} onChange={e=>setEditForm({...editForm, brigade_id:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:10, color:'#fff', outline:'none'}}>
                  <option value="">Не назначена</option>
                  {brigades.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6}}>РОСТ</label>
                  <input type="number" value={editForm.height} onChange={e=>setEditForm({...editForm, height:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:10, color:'#fff', outline:'none'}}/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6}}>ОДЕЖДА</label>
                  <input value={editForm.clothing_size} onChange={e=>setEditForm({...editForm, clothing_size:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:10, color:'#fff', outline:'none'}}/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6}}>ОБУВЬ</label>
                  <input value={editForm.shoe_size} onChange={e=>setEditForm({...editForm, shoe_size:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:10, color:'#fff', outline:'none'}}/>
                </div>
              </div>

              <div style={{display:'flex', gap:12, marginTop:10}}>
                <button onClick={() => setEditingWorker(null)} style={{flex:1, padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:10, color:'rgba(255,255,255,0.6)', fontWeight:700, cursor:'pointer'}}>
                   ОТМЕНА
                </button>
                <button onClick={handleSave} style={{flex:2, padding:'12px', background:'var(--accent)', border:'none', borderRadius:10, color:'#fff', fontWeight:800, cursor:'pointer'}}>
                   СОХРАНИТЬ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmWorker && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div style={{width:'100%', maxWidth:400, background:'var(--bg-surface)', borderRadius:20, border:'1px solid var(--border)', padding:30, textAlign:'center', boxShadow:'0 25px 50px -12px rgba(0, 0, 0, 0.5)'}}>
            <div style={{width:64, height:64, borderRadius:32, background:'rgba(239,68,68,0.1)', color:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}>
              <AlertTriangle size={32}/>
            </div>
            <h2 style={{margin:0, fontSize:20, fontWeight:800, color:'#fff', marginBottom:12}}>Удалить сотрудника?</h2>
            <p style={{margin:0, color:'rgba(255,255,255,0.5)', fontSize:14, lineHeight:1.6, marginBottom:30}}>
              Вы собираетесь безвозвратно удалить <b>{deleteConfirmWorker.name}</b>. 
              Все данные о сессиях этого пользователя будут стерты.
            </p>
            <div style={{display:'flex', gap:12}}>
              <button onClick={() => setDeleteConfirmWorker(null)} style={{flex:1, padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:12, color:'rgba(255,255,255,0.6)', fontWeight:700, cursor:'pointer'}}>
                ОТМЕНА
              </button>
              <button onClick={handleConfirmedDelete} style={{flex:1, padding:'12px', background:'var(--red)', border:'none', borderRadius:12, color:'#fff', fontWeight:800, cursor:'pointer'}}>
                УДАЛИТЬ
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
