'use server'

import db from '@/lib/db'

// Получить список всех сотрудников для выпадающих списков
export async function getWorkers() {
  return db.prepare(`
    SELECT 
      id, name, role, last_name, first_name, patronymic, 
      height, clothing_size, shoe_size, user_color, initials, is_blocked, brigade_id
    FROM workers 
    ORDER BY name
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
  
  // 3. Бригада: количество людей и те, кто отметился сегодня
  const user = db.prepare('SELECT brigade_id FROM workers WHERE id = ?').get(workerId) as { brigade_id: string } | undefined
  let brigadeCount = 0
  let checkedIn = 0
  if (user?.brigade_id) {
    brigadeCount = (db.prepare('SELECT COUNT(*) as count FROM workers WHERE brigade_id = ?').get(user.brigade_id) as any).count
    checkedIn = (db.prepare('SELECT COUNT(*) as count FROM time_entries WHERE brigade_id = ? AND date = ?').get(user.brigade_id, today) as any).count
  }

  // 4. СИЗ: сколько скоро истекает или уже истёк
  const sizWarnings = db.prepare("SELECT COUNT(*) as count FROM siz_items WHERE status = 'expired' OR status = 'active'").get() as { count: number }

  return {
    todayHours: myHours.total || 0,
    activeOrders: activeSupply.count,
    urgentOrders: urgentSupply.count,
    brigadeSize: brigadeCount,
    checkedInCount: checkedIn,
    sizAlerts: sizWarnings.count
  }
}

export async function getStores() {
  return db.prepare('SELECT * FROM stores ORDER BY name').all() as any[]
}
