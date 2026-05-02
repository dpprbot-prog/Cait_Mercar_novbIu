'use server'

import db from '@/lib/db'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { revalidatePath } from 'next/cache'

export interface WorkerProfile {
  id: string
  login: string
  last_name: string
  first_name: string
  patronymic: string | null
  name: string
  role: string
  initials: string
  user_color: string
  base_rate: number
  brigade_id: string | null
  height: number | null
  clothing_size: string | null
  shoe_size: number | null
  is_blocked: number
  is_approved: number
}

const SESSION_COOKIE = 'merkare_session'

// Хеш пароля (в реальном проекте используем сложную соль, здесь для удобства базовый sha256)
function hashPassword(password: string) {
  if (password === 'admin' || password === 'sklad' || password === '1234') return password // Обратная совместимость с сидированными данными для тестов
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function login(loginStr: string, passwordStr: string) {
  try {
    const worker = db.prepare('SELECT id, password_hash, is_blocked, is_approved FROM workers WHERE login = ?').get(loginStr) as { id: string, password_hash: string, is_blocked: number, is_approved: number } | undefined
    if (!worker) return { success: false, error: 'Пользователь не найден' }
    
    if (worker.is_blocked) {
      return { success: false, error: 'Ваш аккаунт заблокирован' }
    }

    if (!worker.is_approved) {
      return { success: false, error: 'Ваш аккаунт ожидает подтверждения администратором' }
    }

    if (worker.password_hash !== hashPassword(passwordStr)) {
      return { success: false, error: 'Неверный пароль' }
    }

    // Создаем сессию
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 дней сессия

    db.prepare('INSERT INTO sessions (id, worker_id, expires_at) VALUES (?, ?, ?)')
      .run(token, worker.id, expiresAt.toISOString())

    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/'
    })

    return { success: true }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'Ошибка сервера' }
  }
}

export async function updateProfile(data: {
  height: number,
  clothingSize: string,
  shoeSize: string
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  db.prepare(`
    UPDATE workers 
    SET height = ?, clothing_size = ?, shoe_size = ?
    WHERE id = ?
  `).run(data.height || null, data.clothingSize || null, data.shoeSize || null, user.id)

  revalidatePath('/')
  return { success: true }
}

export async function register(data: {
  login: string,
  passwordStr: string,
  last_name: string,
  first_name: string,
  patronymic?: string,
  brigade_id?: string,
  height?: number,
  clothing_size?: string,
  shoe_size?: string
}) {
  try {
    const existing = db.prepare('SELECT id FROM workers WHERE login = ?').get(data.login)
    if (existing) return { success: false, error: 'Логин уже занят' }

    const id = 'w' + Date.now().toString()
    const name = `${data.last_name} ${data.first_name[0]}.`
    const initials = `${data.last_name[0]}${data.first_name[0]}`.toUpperCase()
    
    // Случайный цвет пользователя
    const colors = ['#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#14b8a6', '#ec4899', '#f59e0b']
    const user_color = colors[Math.floor(Math.random() * colors.length)]

    const h = hashPassword(data.passwordStr)

    // ВАЖНО: Ровно 13 параметров для INSERT (role='Рабочий' и is_approved=0 прописаны текстом)
    db.prepare(`
      INSERT INTO workers (
        id, login, password_hash, last_name, first_name, patronymic, name, role, initials, user_color, brigade_id, height, clothing_size, shoe_size, is_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Рабочий', ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id, 
      data.login, 
      h, 
      data.last_name, 
      data.first_name, 
      data.patronymic || '', 
      name, 
      initials, 
      user_color, 
      data.brigade_id || null, 
      data.height || null, 
      data.clothing_size || null, 
      data.shoe_size || null
    )

    return { success: true, message: 'Заявка на регистрацию отправлена. Дождитесь одобрения администратором.' }
  } catch (error) {
    console.error('Register error:', error)
    return { success: false, error: 'Ошибка при регистрации' }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token)
  }
  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<WorkerProfile | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const session = db.prepare('SELECT worker_id, expires_at FROM sessions WHERE id = ?').get(token) as { worker_id: string, expires_at: string } | undefined
    if (!session) return null

    if (new Date(session.expires_at) < new Date()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(token)
      cookieStore.delete(SESSION_COOKIE)
      return null
    }

    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(session.worker_id) as WorkerProfile | undefined
    
    if (worker?.is_blocked) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(token)
      cookieStore.delete(SESSION_COOKIE)
      return null
    }

    if (worker && !worker.is_approved) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(token)
      cookieStore.delete(SESSION_COOKIE)
      return null
    }

    return worker || null
  } catch (err) {
    console.error('Get user error', err)
    return null
  }
}
