'use client'

import { useState } from 'react'
import { login, register } from '@/actions/auth'
import { HardHat, LogIn, UserPlus } from 'lucide-react'

export default function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  
  // Login form state
  const [loginStr, setLoginStr] = useState('')
  const [password, setPassword] = useState('')
  
  // Register form state
  const [rLogin, setRLogin] = useState('')
  const [rPassword, setRPassword] = useState('')
  const [rPasswordConfirm, setRPasswordConfirm] = useState('')
  const [rLastName, setRLastName] = useState('')
  const [rFirstName, setRFirstName] = useState('')
  const [rPatronymic, setRPatronymic] = useState('')
  
  // SIZ 
  const [rHeight, setRHeight] = useState('')
  const [rClothing, setRClothing] = useState('L')
  const [rShoe, setRShoe] = useState('42')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await login(loginStr.trim(), password)
    if (!res.success) {
      setError(res.error || 'Ошибка входа')
      setLoading(false)
    } else {
      window.location.reload()
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (rPassword !== rPasswordConfirm) {
      return setError('Пароли не совпадают')
    }
    if (!rLastName.trim() || !rFirstName.trim() || !rLogin.trim() || !rPassword) {
      return setError('Заполните обязательные поля')
    }

    const res = await register({
      login: rLogin.trim(),
      passwordStr: rPassword,
      last_name: rLastName.trim(),
      first_name: rFirstName.trim(),
      patronymic: rPatronymic.trim(),
      height: rHeight ? parseInt(rHeight) : undefined,
      clothing_size: rClothing,
      shoe_size: rShoe ? parseInt(rShoe) : undefined
    })

    if (!res.success) {
      setError(res.error || 'Ошибка при регистрации')
      setLoading(false)
    } else {
      setSuccessMsg(res.message || 'Заявка отправлена! Ожидайте одобрения администратором.')
      setTab('login')
      setLoading(false)
    }
  }

  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'var(--bg)'}}>
      <div style={{width:'100%', maxWidth:400, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:24, boxShadow:'0 10px 40px rgba(0,0,0,0.5)'}}>
        
        <div style={{textAlign:'center', marginBottom:24}}>
          <div style={{display:'inline-flex', alignItems:'center', justifyContent:'center', width:60, height:60, borderRadius:'50%', background:'rgba(234,179,8,0.1)', marginBottom:16}}>
            <HardHat size={32} color="var(--yellow)" />
          </div>
          <h1 style={{fontSize:24, fontWeight:800, color:'#fff', margin:0, letterSpacing:-0.5}}>МЕРКАРЕ</h1>
          <p style={{fontSize:14, color:'var(--text-muted)', marginTop:4}}>Система управления строительством</p>
        </div>

        <div style={{display:'flex', gap:10, marginBottom:24}}>
          <button 
            onClick={()=>setTab('login')} 
            style={{flex:1, padding:'10px', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', border: 'none', background: tab === 'login' ? 'var(--accent)' : 'var(--bg-elevated)', color: tab === 'login' ? '#fff' : 'var(--text-secondary)'}}>
            <LogIn size={16} style={{verticalAlign:'middle', marginRight:6}}/> Вход
          </button>
          <button 
            onClick={()=>setTab('register')} 
            style={{flex:1, padding:'10px', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', border: 'none', background: tab === 'register' ? 'var(--accent)' : 'var(--bg-elevated)', color: tab === 'register' ? '#fff' : 'var(--text-secondary)'}}>
            <UserPlus size={16} style={{verticalAlign:'middle', marginRight:6}}/> Регистрация
          </button>
        </div>

        {error && (
          <div style={{padding:'12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'var(--red)', fontSize:13, fontWeight:600, marginBottom:16, textAlign:'center'}}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{padding:'12px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:6, color:'var(--green)', fontSize:13, fontWeight:600, marginBottom:16, textAlign:'center'}}>
            {successMsg}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:12}}>
            <div>
              <label style={{display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:6, fontWeight:600}}>Логин</label>
              <input required value={loginStr} onChange={e=>setLoginStr(e.target.value)} placeholder="ivanov" style={{width:'100%', padding:'12px 14px', background:'var(--bg-elevated)', border:'1px solid var(--border-light)', borderRadius:6, color:'#fff', outline:'none', fontSize:15}} />
            </div>
            <div>
              <label style={{display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:6, fontWeight:600}}>Пароль</label>
              <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{width:'100%', padding:'12px 14px', background:'var(--bg-elevated)', border:'1px solid var(--border-light)', borderRadius:6, color:'#fff', outline:'none', fontSize:15}} />
            </div>
            <button disabled={loading} type="submit" style={{marginTop:8, padding:'14px', background:'var(--accent)', border:'none', borderRadius:6, color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', opacity: loading ? 0.7 : 1}}>
              {loading ? 'Загрузка...' : 'Войти в систему'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} style={{display:'flex', flexDirection:'column', gap:12}}>
            
            <div style={{background:'rgba(255,255,255,0.02)', padding:12, borderRadius:6, border:'1px solid var(--border-light)', marginBottom:4}}>
              <h4 style={{fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:10, textTransform:'uppercase'}}>Личные данные</h4>
              <div style={{display:'flex', gap:10, marginBottom:10}}>
                <input required placeholder="Фамилия*" value={rLastName} onChange={e=>setRLastName(e.target.value)} style={{width:'100%', minWidth:0, flex:1, padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
                <input required placeholder="Имя*" value={rFirstName} onChange={e=>setRFirstName(e.target.value)} style={{width:'100%', minWidth:0, flex:1, padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
              </div>
              <input placeholder="Отчество (не обязательно)" value={rPatronymic} onChange={e=>setRPatronymic(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
            </div>

            <div style={{background:'rgba(234,179,8,0.02)', padding:12, borderRadius:6, border:'1px solid rgba(234,179,8,0.1)', marginBottom:4}}>
              <h4 style={{fontSize:12, fontWeight:700, color:'var(--yellow)', marginBottom:10, textTransform:'uppercase'}}>Антропометрия (Для СИЗ)</h4>
              <div style={{display:'flex', gap:10}}>
                <div style={{flex:1, minWidth:0}}>
                  <label style={{display:'block', fontSize:11, color:'var(--text-muted)', marginBottom:4}}>Рост, см</label>
                  <input placeholder="175" value={rHeight} onChange={e=>setRHeight(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <label style={{display:'block', fontSize:11, color:'var(--text-muted)', marginBottom:4}}>Обувь</label>
                  <input placeholder="42" value={rShoe} onChange={e=>setRShoe(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <label style={{display:'block', fontSize:11, color:'var(--text-muted)', marginBottom:4}}>Одежда</label>
                  <input list="clothing-sizes" placeholder="52" value={rClothing} onChange={e=>setRClothing(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
                  <datalist id="clothing-sizes">
                    {['48','50','52','54','56','S','M','L','XL','XXL'].map(s=><option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
            </div>

            <div style={{background:'rgba(255,255,255,0.02)', padding:12, borderRadius:6, border:'1px solid var(--border-light)'}}>
              <h4 style={{fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:10, textTransform:'uppercase'}}>Учетная запись</h4>
              <div style={{marginBottom:10}}>
                <input required placeholder="Логин*" value={rLogin} onChange={e=>setRLogin(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
              </div>
              <div style={{display:'flex', gap:10}}>
                <input required type="password" placeholder="Пароль*" value={rPassword} onChange={e=>setRPassword(e.target.value)} style={{width:'100%', minWidth:0, flex:1, padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
                <input required type="password" placeholder="Повторите*" value={rPasswordConfirm} onChange={e=>setRPasswordConfirm(e.target.value)} style={{width:'100%', minWidth:0, flex:1, padding:'10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:4, color:'#fff', outline:'none', fontSize:14}} />
              </div>
            </div>

            <button disabled={loading} type="submit" style={{marginTop:8, padding:'14px', background:'var(--accent)', border:'none', borderRadius:6, color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', opacity: loading ? 0.7 : 1}}>
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
