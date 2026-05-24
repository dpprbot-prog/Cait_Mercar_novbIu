'use server'

import db from '@/lib/db'

// Получить список всех сотрудников для выпадающих списков
export async function getWorkers() {
  return db.prepare(`
    SELECT 
      w.id, w.login, w.name, w.role, w.last_name, w.first_name, w.patronymic, 
      w.height, w.clothing_size, w.shoe_size, w.user_color, w.initials, w.is_blocked, w.is_approved, w.brigade_id,
      b.name as brigade_name
    FROM workers w
    LEFT JOIN brigades b ON w.brigade_id = b.id
    ORDER BY w.name
  `).all() as any[]
}

// Получить список объектов
export async function getObjects() {
  const rows = db.prepare('SELECT name FROM objects ORDER BY name').all() as { name: string }[]
  return rows.map(r => r.name)
}

// Получить список водителей
export async function getDrivers() {
  return db.prepare("SELECT name FROM workers WHERE role = 'Водитель' OR role = 'Бригадир' ORDER BY name").all() as { name: string }[]
}

export async function getDashboardStats(workerId: string) {
  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
  
  // 1. Прямо сейчас: мои часы
  const myHours = db.prepare('SELECT SUM(hours_total) as total FROM time_entries WHERE worker_id = ? AND date = ?').get(workerId, today) as { total: number | null }
  
  // 2. Снабжение: активные (не доставленные)
  const activeSupply = db.prepare("SELECT COUNT(*) as count FROM supply_items WHERE m_status NOT IN ('delivered', 'accepted')").get() as { count: number }
  const urgentSupply = db.prepare("SELECT COUNT(*) as count FROM supply_orders o JOIN supply_items i ON o.id = i.order_id WHERE o.priority = 'urgent' AND i.m_status NOT IN ('delivered', 'accepted')").get() as { count: number }
  
  // 3. Узнаем роль пользователя
  const currentUser = db.prepare('SELECT role FROM workers WHERE id = ?').get(workerId) as { role: string } | undefined
  const isAdmin = currentUser?.role === 'Админ'

  // 4. Бригада: количество людей и те, кто отметился сегодня
  let brigadeCount = 0
  let checkedIn = 0
  let brigadeMembers: any[] = []
  let brigadeName = '—'

  if (isAdmin) {
    // Для Админа: выбираем вообще всех активных сотрудников компании
    brigadeName = 'Все бригады'
    const members = db.prepare(`
      SELECT w.id, w.login, w.name, w.user_color, w.initials, w.role, w.brigade_id, b.name as brigade_name
      FROM workers w
      LEFT JOIN brigades b ON w.brigade_id = b.id
      WHERE w.is_approved = 1 AND w.is_blocked = 0
      ORDER BY w.name
    `).all() as any[]

    brigadeMembers = members.map(m => {
      const entry = db.prepare(`
        SELECT start_time, end_time, lunch_min, hours_total 
        FROM time_entries 
        WHERE worker_id = ? AND date = ?
      `).get(m.id, today) as any

      return {
        ...m,
        hasCheckedIn: !!entry,
        details: entry ? {
          start: entry.start_time,
          end: entry.end_time,
          lunch: entry.lunch_min,
          total: entry.hours_total
        } : null
      }
    })

    brigadeCount = members.length
    checkedIn = brigadeMembers.filter(m => m.hasCheckedIn).length
  } else {
    // Для обычного пользователя/бригадира: берем только его бригаду
    const user = db.prepare(`
      SELECT w.brigade_id, b.name as brigade_name 
      FROM workers w 
      LEFT JOIN brigades b ON w.brigade_id = b.id 
      WHERE w.id = ?
    `).get(workerId) as { brigade_id: string, brigade_name: string | null } | undefined

    if (user?.brigade_id) {
      brigadeName = user.brigade_name || user.brigade_id
      const members = db.prepare(`
        SELECT id, login, name, user_color, initials, role
        FROM workers 
        WHERE brigade_id = ? AND is_approved = 1 AND is_blocked = 0
        ORDER BY name
      `).all(user.brigade_id) as any[]

      brigadeMembers = members.map(m => {
        const entry = db.prepare(`
          SELECT start_time, end_time, lunch_min, hours_total 
          FROM time_entries 
          WHERE worker_id = ? AND date = ?
        `).get(m.id, today) as any

        return {
          ...m,
          hasCheckedIn: !!entry,
          details: entry ? {
            start: entry.start_time,
            end: entry.end_time,
            lunch: entry.lunch_min,
            total: entry.hours_total
          } : null
        }
      })

      brigadeCount = members.length
      checkedIn = brigadeMembers.filter(m => m.hasCheckedIn).length
    }
  }

  // 5. СИЗ: сколько скоро истекает или уже истёк
  const sizItems = db.prepare("SELECT status, expiryDate FROM siz_items WHERE status = 'expired' OR status = 'active'").all() as { status: string, expiryDate: string }[]
  
  let sizAlertsCount = 0
  const nowMs = Date.now()
  for (const item of sizItems) {
    if (item.status === 'expired') {
      sizAlertsCount++
    } else if (item.status === 'active' && item.expiryDate) {
      const parts = item.expiryDate.split('.')
      if (parts.length === 3) {
        const expiryTime = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime()
        const daysLeft = Math.ceil((expiryTime - nowMs) / 86400000)
        if (daysLeft <= 30) {
          sizAlertsCount++
        }
      }
    }
  }

  return {
    todayHours: myHours.total || 0,
    activeOrders: activeSupply.count,
    urgentOrders: urgentSupply.count,
    brigadeSize: brigadeCount,
    checkedInCount: checkedIn,
    brigadeName,
    brigadeMembers, // Новый список с деталями
    sizAlerts: sizAlertsCount
  }
}

export async function getStores() {
  return db.prepare('SELECT * FROM stores ORDER BY name').all() as any[]
}

// Получить список всех Бригад
export async function getBrigades() {
  return db.prepare('SELECT id, name FROM brigades ORDER BY name').all() as { id: string, name: string }[]
}
