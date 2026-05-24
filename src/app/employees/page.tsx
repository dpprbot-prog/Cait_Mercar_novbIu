'use client'
import { useState, useEffect } from 'react'
import { Search, Plus, Filter, Users, Edit, Trash2, Shield, Lock, Unlock, Check, X, AlertTriangle, Download, Eye, EyeOff, MapPin, Shirt, Footprints } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { getWorkers, getBrigades } from '@/actions/common'
import { deleteWorker, toggleWorkerBlock, updateWorkerAdmin, approveWorker } from '@/actions/admin'
import Modal from '@/components/Modal'
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
  const [statusFilter, setStatusFilter] = useState('active') // all, active, blocked
  const [loading, setLoading] = useState(true)

  const [showEdit, setShowEdit] = useState(false)
  const [editingWorker, setEditingWorker] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    type: 'danger' | 'info' | 'success' | 'warning',
    onConfirm?: () => void,
    showConfirm?: boolean
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  const showAlert = (title: string, message: string, type: any = 'info') => {
    setModal({ isOpen: true, title, message, type, showConfirm: false })
  }

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: any = 'warning') => {
    setModal({ isOpen: true, title, message, type, onConfirm, showConfirm: true })
  }

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
    setEditingWorker({ ...w })
    setNewPassword('')
    setShowEdit(true)
  }

  const handleSave = async () => {
    if (!editingWorker) return
    const res = await updateWorkerAdmin(editingWorker.id, {
      ...editingWorker,
      passwordStr: newPassword || undefined
    })

    if (res.success) {
      setWorkers(prev => prev.map(w => w.id === editingWorker.id ? { ...w, ...editingWorker } : w))
      setShowEdit(false)
      showAlert('Готово', 'Данные сотрудника успешно обновлены', 'success')
    } else {
      showAlert('Ошибка', res.error || 'Не удалось обновить данные', 'danger')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    showConfirm(
      'Удаление сотрудника',
      `Вы действительно хотите навсегда удалить сотрудника ${name}? Все его записи в табеле и финансах будут стерты.`,
      async () => {
        const res = await deleteWorker(id)
        if (res.success) {
          setWorkers(prev => prev.filter(w => w.id !== id))
        } else {
          showAlert('Ошибка', res.error || 'Не удалось удалить', 'danger')
        }
      },
      'danger'
    )
  }

  const handleToggleBlock = async (worker: any) => {
    const res = await toggleWorkerBlock(worker.id)
    if (res.success) {
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, is_blocked: !w.is_blocked } : w))
    } else {
      showAlert('Ошибка', res.error || 'Не удалось изменить статус', 'danger')
    }
  }

  const handleExport = async () => {
    const res = await exportEmployeesExcel()
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

  const handleApprove = async (id: string) => {
    const res = await approveWorker(id, { 
      role: 'Рабочий',
      brigade_id: null 
    })
    if (res.success) {
      refreshData()
    } else {
      showAlert('Ошибка', res.error || 'Не удалось одобрить', 'danger')
    }
  }

  const pendingWorkers = workers.filter(w => !w.is_approved)
  const approvedWorkers = workers.filter(w => w.is_approved)

  const filtered = approvedWorkers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) || (w.login && w.login.toLowerCase().includes(search.toLowerCase()))
    const matchesRole = !roleFilter || w.role === roleFilter
    const matchesBrigade = !brigadeFilter || w.brigade_id === brigadeFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && !w.is_blocked) || (statusFilter === 'blocked' && w.is_blocked)
    return matchesSearch && matchesRole && matchesBrigade && matchesStatus
  })

  const roles = ['Админ', 'Мастер', 'Бригадир', 'Склад', 'Водитель', 'Бетонщик', 'Отделочник', 'Подсобник', 'Рабочий', 'Геодезист', 'Охрана']

  const stats = {
    total: workers.length,
    active: workers.filter(w=>!w.is_blocked).length,
    blocked: workers.filter(w=>w.is_blocked).length
  }

  return (
    <AppLayout>
      <div className="page-header" style={{marginBottom:24}}>
        <h1 style={{color:'#fff', display:'flex', alignItems:'center', gap:10}}>
          <Users size={24} color="var(--accent)"/> Сотрудники
        </h1>
      </div>

      {/* Statistics Cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:24}}>
        <div style={{background:'var(--bg-surface)', padding:'18px 24px', borderRadius:20, border:'1px solid rgba(255,255,255,0.05)', borderLeft:'4px solid var(--accent)', boxShadow:'0 10px 30px rgba(0,0,0,0.3)', position:'relative', overflow:'hidden'}}>
           <div style={{position:'absolute', right:-10, top:-10, opacity:0.05}}><Users size={80} color="var(--accent)"/></div>
           <div style={{fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8}}>ВСЕГО В БАЗЕ</div>
           <div style={{fontSize:36, fontWeight:900, color:'#fff', lineHeight:1, display:'flex', alignItems:'center', gap:12}}>
             {stats.total}
           </div>
           <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:8}}>Зарегистрировано пользователей</div>
        </div>

        <div style={{background:'var(--bg-surface)', padding:'18px 24px', borderRadius:20, border:'1px solid rgba(34,197,94,0.1)', borderLeft:'4px solid var(--green)', boxShadow:'0 10px 30px rgba(0,0,0,0.3)', position:'relative', overflow:'hidden'}}>
           <div style={{position:'absolute', right:-10, top:-10, opacity:0.05}}><Check size={80} color="var(--green)"/></div>
           <div style={{fontSize:11, color:'var(--green)', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, opacity:0.7}}>АКТИВНЫЕ</div>
           <div style={{fontSize:36, fontWeight:900, color:'var(--green)', lineHeight:1, display:'flex', alignItems:'center', gap:12}}>
             {stats.active}
           </div>
           <div style={{fontSize:11, color:'rgba(34,197,94,0.3)', marginTop:8}}>Имеют доступ к системе</div>
        </div>

        <div style={{background:'var(--bg-surface)', padding:'18px 24px', borderRadius:20, border:'1px solid rgba(239,68,68,0.1)', borderLeft:'4px solid var(--red)', boxShadow:'0 10px 30px rgba(0,0,0,0.3)', position:'relative', overflow:'hidden'}}>
           <div style={{position:'absolute', right:-10, top:-10, opacity:0.05}}><Lock size={80} color="var(--red)"/></div>
           <div style={{fontSize:11, color:'var(--red)', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, opacity:0.7}}>ЗАБЛОКИРОВАНО</div>
           <div style={{fontSize:36, fontWeight:900, color:'var(--red)', lineHeight:1, display:'flex', alignItems:'center', gap:12}}>
             {stats.blocked}
           </div>
           <div style={{fontSize:11, color:'rgba(239,68,68,0.3)', marginTop:8}}>Доступ временно ограничен</div>
        </div>

        <div style={{background:'var(--bg-elevated)', padding:'18px 24px', borderRadius:20, border:'1px solid rgba(255,255,255,0.05)', borderLeft:'4px solid var(--yellow)', cursor:'pointer', transition:'all 0.2s', position:'relative', overflow:'hidden'}} onClick={handleExport} className="hover-scale">
           <div style={{position:'absolute', right:-10, top:-10, opacity:0.05}}><Download size={80} color="var(--yellow)"/></div>
           <div style={{fontSize:11, color:'var(--yellow)', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, opacity:0.7}}>ОТЧЕТНОСТЬ</div>
           <div style={{fontSize:22, fontWeight:900, color:'var(--yellow)', display:'flex', alignItems:'center', gap:10}}>
             <Download size={20}/> EXCEL
           </div>
           <div style={{fontSize:11, color:'rgba(234,179,8,0.3)', marginTop:12}}>Выгрузить список в таблицу</div>
        </div>
      </div>

      {isAdmin && pendingWorkers.length > 0 && (
        <div style={{background:'rgba(234,179,8,0.05)', border:'1px solid rgba(234,179,8,0.2)', borderRadius:16, padding:20, marginBottom:24}}>
          <h2 style={{fontSize:16, fontWeight:800, color:'var(--yellow)', marginBottom:16, display:'flex', alignItems:'center', gap:8}}>
            <AlertTriangle size={18}/> НОВЫЕ ЗАЯВКИ ({pendingWorkers.length})
          </h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12}}>
            {pendingWorkers.map(w => (
              <div key={w.id} style={{background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, padding:16, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{display:'flex', alignItems:'center', gap:12}}>
                  <div style={{width:40, height:40, borderRadius:10, background:w.user_color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14}}>
                    {w.initials}
                  </div>
                  <div>
                    <div style={{fontWeight:700, color:'#fff'}}>{`${w.last_name || ''} ${w.first_name || ''} ${w.patronymic || ''}`.trim() || w.name}</div>
                    <div style={{fontSize:11, color:'var(--text-muted)'}}>Логин: {w.login}</div>
                  </div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={() => handleDelete(w.id, w.name)} style={{padding:'8px', borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'var(--red)', cursor:'pointer'}}>
                    <X size={16}/>
                  </button>
                  <button onClick={() => handleApprove(w.id)} style={{padding:'8px 16px', borderRadius:8, background:'var(--green)', border:'none', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6}}>
                    <Check size={16}/> ОДОБРИТЬ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{background:'var(--bg-surface)', padding:16, borderRadius:12, border:'1px solid var(--border)', marginBottom:20, display:'flex', flexWrap:'wrap', gap:12, alignItems:'center'}}>
        <input 
          placeholder="Поиск..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{flex:2, minWidth:200, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', color:'#fff', outline:'none', fontSize:13}}
        />
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

      <div style={{background:'var(--bg-surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden'}}>
        {loading ? <div style={{padding:40, textAlign:'center'}}>Загрузка...</div> : (
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
            <thead>
              <tr style={{background:'rgba(255,255,255,0.03)', borderBottom:'1px solid var(--border)'}}>
                <th style={{padding:12, textAlign:'left'}}>Сотрудник</th>
                <th style={{padding:12, textAlign:'left'}}>Роль</th>
                <th style={{padding:12, textAlign:'left'}}>Бригада</th>
                <th style={{padding:12, textAlign:'center'}}>Статус</th>
                <th style={{padding:12, textAlign:'right'}}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id} style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:12}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:32, height:32, borderRadius:8, background: w.user_color || 'var(--bg-elevated)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0}}>
                        {w.initials}
                      </div>
                      <div>
                        <div style={{fontWeight:700}}>{`${w.last_name || ''} ${w.first_name || ''} ${w.patronymic || ''}`.trim() || w.name}</div>
                        <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>{w.login}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:12}}>{w.role}</td>
                  <td style={{padding:12, color: w.brigade_name ? '#fff' : 'var(--text-muted)'}}>{w.brigade_name || '—'}</td>
                  <td style={{padding:12, textAlign:'center'}}>
                    <span className={`badge-pill ${w.is_blocked ? 'badge-red' : 'badge-green'}`} style={{fontSize:10}}>
                      {w.is_blocked ? 'БЛОК' : 'АКТИВЕН'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px', textAlign:'right'}}>
                    <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                      <button 
                        onClick={()=>handleEditClick(w)} 
                        title="Редактировать"
                        style={{width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.1)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.2)', transition:'all 0.2s', cursor:'pointer'}}
                        onMouseEnter={e => { e.currentTarget.style.background='#3b82f6'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(59,130,246,0.1)'; e.currentTarget.style.color='#3b82f6'; }}
                      >
                        <Edit size={14}/>
                      </button>
                      <button 
                        onClick={()=>handleToggleBlock(w)}
                        title={w.is_blocked ? "Разблокировать" : "Заблокировать"}
                        style={{width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:w.is_blocked ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)', color:w.is_blocked ? 'var(--green)' : 'var(--yellow)', border:w.is_blocked ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(234,179,8,0.2)', transition:'all 0.2s', cursor:'pointer'}}
                        onMouseEnter={e => { e.currentTarget.style.background = w.is_blocked ? 'var(--green)' : 'var(--yellow)'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = w.is_blocked ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)'; e.currentTarget.style.color = w.is_blocked ? 'var(--green)' : 'var(--yellow)'; }}
                      >
                        {w.is_blocked ? <Unlock size={14}/> : <Lock size={14}/>}
                      </button>
                      <button 
                        onClick={()=>handleDelete(w.id, w.name)}
                        title="Удалить"
                        style={{width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.1)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.2)', transition:'all 0.2s', cursor:'pointer'}}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--red)'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='var(--red)'; }}
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showEdit && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)'}}>
          <div style={{background:'var(--bg-surface)', padding:24, borderRadius:20, width:'100%', maxWidth:500, border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto'}}>
            <h2 style={{color:'#fff', marginBottom:24, fontSize:20}}>Редактирование сотрудника</h2>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
              <div>
                <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>ФАМИЛИЯ</label>
                <input value={editingWorker.last_name || ''} onChange={e=>setEditingWorker({...editingWorker, last_name:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:10, borderRadius:10, color:'#fff'}}/>
              </div>
              <div>
                <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>ИМЯ</label>
                <input value={editingWorker.first_name || ''} onChange={e=>setEditingWorker({...editingWorker, first_name:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:10, borderRadius:10, color:'#fff'}}/>
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>РОЛЬ</label>
              <select value={editingWorker.role || ''} onChange={e=>setEditingWorker({...editingWorker, role:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:10, borderRadius:10, color:'#fff'}}>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>БРИГАДА</label>
              <select value={editingWorker.brigade_id || ''} onChange={e=>setEditingWorker({...editingWorker, brigade_id:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:12, borderRadius:12, color:'#fff', outline:'none'}}>
                <option value="">Без бригады</option>
                {brigades.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div style={{marginBottom:16}}>
              <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>НОВЫЙ ПАРОЛЬ (ОСТАВЬТЕ ПУСТЫМ, ЧТОБЫ НЕ МЕНЯТЬ)</label>
              <div style={{position:'relative'}}>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:12, borderRadius:12, color:'#fff', outline:'none'}}
                  placeholder="••••••••"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', padding:4}}
                >
                  {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12}}>
              <div>
                <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>РОСТ</label>
                <input type="number" value={editingWorker.height || ''} onChange={e=>setEditingWorker({...editingWorker, height:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:10, borderRadius:10, color:'#fff'}}/>
              </div>
              <div>
                <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>ОДЕЖДА</label>
                <input value={editingWorker.clothing_size || ''} onChange={e=>setEditingWorker({...editingWorker, clothing_size:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:10, borderRadius:10, color:'#fff'}}/>
              </div>
              <div>
                <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>ОБУВЬ</label>
                <input value={editingWorker.shoe_size || ''} onChange={e=>setEditingWorker({...editingWorker, shoe_size:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:10, borderRadius:10, color:'#fff'}}/>
              </div>
            </div>

            <div style={{marginBottom:24}}>
              <label style={{fontSize:11, opacity:0.5, display:'block', marginBottom:4}}>ЛОГИН (@)</label>
              <input value={editingWorker.login || ''} onChange={e=>setEditingWorker({...editingWorker, login:e.target.value})} style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:10, borderRadius:10, color:'#fff'}}/>
            </div>

            <div style={{display:'flex', gap:12}}>
              <button onClick={()=>setShowEdit(false)} style={{flex:1, padding:'12px', borderRadius:12, border:'1px solid var(--border)', background:'transparent', color:'#fff', fontWeight:600}}>Отмена</button>
              <button onClick={handleSave} style={{flex:1, padding:'12px', borderRadius:12, border:'none', background:'var(--accent)', color:'#fff', fontWeight:700}}>Сохранить</button>
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
        showConfirm={modal.showConfirm}
      />
    </AppLayout>
  )
}
