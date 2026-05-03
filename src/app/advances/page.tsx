'use client'
import { useState, useEffect, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { 
  Plus, Search, Calendar, User, DollarSign, 
  Trash2, Filter, ArrowUpDown, Wallet, Building2, UserCircle, Download
} from 'lucide-react'
import { getAdvances, createAdvance, deleteAdvance, Advance } from '@/actions/finance'
import { getWorkers } from '@/actions/common'
import { useAuth } from '@/components/AuthProvider'

const SOURCE_LABELS: Record<string, {label:string; icon:any; color:string}> = {
  personal: { label: 'Личные (Вадим)', icon: UserCircle, color: '#f97316' },
  firm:     { label: 'Фирма',          icon: Building2,  color: '#3b82f6' },
  director: { label: 'Директор',       icon: Wallet,     color: '#8b5cf6' },
}

export default function AdvancesPage() {
  const { user } = useAuth()
  const [advances, setAdvances] = useState<Advance[]>([])
  const [workers, setWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  
  // Form State
  const [fWorkerId, setFWorkerId] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0])
  const [fSource, setFSource] = useState('personal')
  const [fDesc, setFDesc] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [advData, workersData] = await Promise.all([
      getAdvances(),
      getWorkers()
    ])
    setAdvances(advData)
    setWorkers(workersData)
    setLoading(false)
  }

  const handleExport = () => {
    const headers = ['Дата', 'Сотрудник', 'Сумма', 'Источник', 'Комментарий', 'Выдал']
    const rows = filtered.map(a => [
      new Date(a.date).toLocaleDateString('ru-RU'),
      a.worker_name,
      a.amount.toString(),
      SOURCE_LABELS[a.source]?.label || a.source,
      (a.description || '').replace(/"/g, '""'),
      a.author_name || 'Система'
    ])
    
    const csvContent = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `advances_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    return advances.filter(a => 
      a.worker_name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
    )
  }, [advances, search])

  const handleCreate = async () => {
    if (!fWorkerId || !fAmount || !fDate) return
    await createAdvance({
      worker_id: fWorkerId,
      amount: parseInt(fAmount),
      date: fDate,
      source: fSource,
      description: fDesc
    })
    setShowModal(false)
    setFWorkerId(''); setFAmount(''); setFDesc('')
    loadData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить запись об авансе?')) return
    await deleteAdvance(id)
    loadData()
  }

  return (
    <AppLayout>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <div>
          <h1 style={{color:'#fff', margin:0}}>Учёт авансов</h1>
          <p style={{color:'rgba(255,255,255,0.5)', margin:'4px 0 0 0'}}>История выдачи денежных средств сотрудникам</p>
        </div>
        <div style={{display:'flex', gap:12}}>
          <button 
            onClick={handleExport}
            style={{background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)', padding:'12px 20px', borderRadius:12, fontWeight:700, display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}
          >
            <Download size={18}/> Экспорт CSV
          </button>
          <button 
            onClick={() => setShowModal(true)}
            style={{background:'var(--accent)', color:'#fff', border:'none', padding:'12px 20px', borderRadius:12, fontWeight:700, display:'flex', alignItems:'center', gap:8, cursor:'pointer', boxShadow:'0 4px 15px rgba(201,55,44,0.3)'}}
          >
            <Plus size={18}/> Выдать аванс
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:16, padding:16, marginBottom:24, display:'flex', gap:16}}>
        <div style={{position:'relative', flex:1}}>
          <Search size={18} style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)'}}/>
          <input 
            placeholder="Поиск по сотруднику или комментарию..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:'12px 12px 12px 40px', borderRadius:10, color:'#fff', outline:'none'}}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden'}}>
        <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
          <thead>
            <tr style={{background:'rgba(255,255,255,0.05)', borderBottom:'1px solid var(--border)'}}>
              <th style={{padding:16, color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Дата</th>
              <th style={{padding:16, color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Сотрудник</th>
              <th style={{padding:16, color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Сумма</th>
              <th style={{padding:16, color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Источник</th>
              <th style={{padding:16, color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Комментарий</th>
              <th style={{padding:16, color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Выдал</th>
              <th style={{padding:16}}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(adv => {
              const src = SOURCE_LABELS[adv.source] || {label: adv.source, icon: DollarSign, color: '#666'}
              return (
                <tr key={adv.id} style={{borderBottom:'1px solid var(--border)', transition:'background 0.2s'}} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{padding:16, color:'#fff', fontWeight:500}}>{new Date(adv.date).toLocaleDateString('ru-RU')}</td>
                  <td style={{padding:16}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:32, height:32, background:'rgba(255,255,255,0.05)', borderRadius:'50%', display:'flex', alignItems:'center', justifySelf:'center', justifyContent:'center', color:'var(--accent)', fontWeight:700, fontSize:12}}>
                        {adv.worker_name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{color:'#fff', fontWeight:600}}>{adv.worker_name}</span>
                    </div>
                  </td>
                  <td style={{padding:16}}>
                    <span style={{color:'var(--accent)', fontWeight:800, fontSize:16}}>{adv.amount.toLocaleString()} ₽</span>
                  </td>
                  <td style={{padding:16}}>
                    <div style={{display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:src.color+'15', color:src.color, fontSize:12, fontWeight:700}}>
                      <src.icon size={14}/> {src.label}
                    </div>
                  </td>
                  <td style={{padding:16, color:'rgba(255,255,255,0.6)', fontSize:13}}>{adv.description || '—'}</td>
                  <td style={{padding:16, color:'rgba(255,255,255,0.4)', fontSize:12}}>{adv.author_name || 'Система'}</td>
                  <td style={{padding:16, textAlign:'right'}}>
                    <button 
                      onClick={() => handleDelete(adv.id)}
                      style={{background:'none', border:'none', color:'rgba(255,255,255,0.2)', cursor:'pointer', padding:8, borderRadius:8, transition:'all 0.2s'}}
                      onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.2)'}
                    >
                      <Trash2 size={18}/>
                    </button>
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{padding:40, textAlign:'center', color:'rgba(255,255,255,0.3)'}}>Записей не найдено</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div style={{background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:24, padding:32, width:'100%', maxWidth:500, boxShadow:'0 20px 50px rgba(0,0,0,0.5)'}}>
            <h2 style={{color:'#fff', marginTop:0, marginBottom:24, display:'flex', alignItems:'center', gap:12}}>
              <DollarSign color="var(--accent)"/> Выдача аванса
            </h2>
            
            <div style={{display:'grid', gap:20}}>
              <div>
                <label style={{display:'block', fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8, fontWeight:700, textTransform:'uppercase'}}>Кому</label>
                <select 
                  value={fWorkerId} 
                  onChange={e => setFWorkerId(e.target.value)}
                  style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:12, borderRadius:12, color:'#fff', outline:'none'}}
                >
                  <option value="">Выберите сотрудника...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                <div>
                  <label style={{display:'block', fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8, fontWeight:700, textTransform:'uppercase'}}>Сумма (₽)</label>
                  <input 
                    type="number" 
                    value={fAmount} 
                    onChange={e => setFAmount(e.target.value)}
                    placeholder="0"
                    style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:12, borderRadius:12, color:'#fff', outline:'none', fontSize:18, fontWeight:800}}
                  />
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8, fontWeight:700, textTransform:'uppercase'}}>Дата</label>
                  <input 
                    type="date" 
                    value={fDate} 
                    onChange={e => setFDate(e.target.value)}
                    style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:12, borderRadius:12, color:'#fff', outline:'none'}}
                  />
                </div>
              </div>

              <div>
                <label style={{display:'block', fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8, fontWeight:700, textTransform:'uppercase'}}>Источник денег</label>
                <div style={{display:'flex', gap:8}}>
                  {Object.entries(SOURCE_LABELS).map(([key, info]) => (
                    <button 
                      key={key}
                      onClick={() => setFSource(key)}
                      style={{
                        flex:1, padding:'10px 4px', borderRadius:10, border:'1px solid', 
                        borderColor: fSource === key ? info.color : 'var(--border)',
                        background: fSource === key ? info.color+'15' : 'transparent',
                        color: fSource === key ? info.color : 'rgba(255,255,255,0.4)',
                        cursor:'pointer', transition:'all 0.2s', fontSize:11, fontWeight:700,
                        display:'flex', flexDirection:'column', alignItems:'center', gap:4
                      }}
                    >
                      <info.icon size={18}/>
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{display:'block', fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8, fontWeight:700, textTransform:'uppercase'}}>Комментарий</label>
                <textarea 
                  value={fDesc} 
                  onChange={e => setFDesc(e.target.value)}
                  placeholder="На что выдан аванс..."
                  style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:12, borderRadius:12, color:'#fff', outline:'none', minHeight:80, resize:'none'}}
                />
              </div>

              <div style={{display:'flex', gap:12, marginTop:12}}>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', padding:14, borderRadius:12, color:'rgba(255,255,255,0.6)', fontWeight:600, cursor:'pointer'}}
                >
                  Отмена
                </button>
                <button 
                  onClick={handleCreate}
                  disabled={!fWorkerId || !fAmount}
                  style={{flex:2, background:'var(--accent)', border:'none', padding:14, borderRadius:12, color:'#fff', fontWeight:800, cursor:'pointer', boxShadow:'0 4px 15px rgba(201,55,44,0.3)'}}
                >
                  Подтвердить выдачу
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
