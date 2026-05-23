'use server'

import db from '@/lib/db'
import { getCurrentUser } from './auth'
import { revalidatePath } from 'next/cache'

export async function getNotifications() {
  const user = await getCurrentUser()
  if (!user) return []
  
  return db.prepare('SELECT * FROM notifications WHERE worker_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(user.id) as any[]
}

export async function markAsRead(id: number) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id)
  revalidatePath('/')
}

export async function markAllAsRead() {
  const user = await getCurrentUser()
  if (!user) return
  db.prepare('UPDATE notifications SET is_read = 1 WHERE worker_id = ?').run(user.id)
  revalidatePath('/')
}

export async function getNotificationSettings() {
  const user = await getCurrentUser()
  if (!user) return null
  
  return db.prepare('SELECT * FROM notification_settings WHERE worker_id = ?').get(user.id) as any
}

export async function updateNotificationSettings(settings: {
  notify_siz: boolean,
  notify_supply: boolean,
  notify_admin_tasks: boolean
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false }
  
  db.prepare(`
    INSERT OR REPLACE INTO notification_settings (worker_id, notify_siz, notify_supply, notify_admin_tasks)
    VALUES (?, ?, ?, ?)
  `).run(
    user.id,
    settings.notify_siz ? 1 : 0,
    settings.notify_supply ? 1 : 0,
    settings.notify_admin_tasks ? 1 : 0
  )
  
  revalidatePath('/')
  return { success: true }
}

// Вспомогательная функция для создания уведомления (вызывать из других экшенов)
export async function createNotification(workerId: string, type: string, title: string, message: string) {
  // Проверяем настройки пользователя перед созданием
  const settings = db.prepare('SELECT * FROM notification_settings WHERE worker_id = ?').get(workerId) as any
  
  let shouldNotify = true
  if (settings) {
    if (type === 'siz' && !settings.notify_siz) shouldNotify = false
    if (type === 'supply' && !settings.notify_supply) shouldNotify = false
    if (type === 'admin_approval' && !settings.notify_admin_tasks) shouldNotify = false
  }

  if (shouldNotify) {
    db.prepare('INSERT INTO notifications (worker_id, type, title, message) VALUES (?, ?, ?, ?)')
      .run(workerId, type, title, message)
  }
}

export async function approvePendingTimeEntry(timeEntryId: number, notificationId: number) {
  // 1. Approve time entry
  db.prepare('UPDATE time_entries SET is_approved = 1 WHERE id = ?').run(timeEntryId)
  
  // 2. Mark the notification as read
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId)
  
  // 3. Mark matching notifications as read for all other users (since it is already approved)
  db.prepare('UPDATE notifications SET is_read = 1 WHERE type = ?').run(`time_approval:${timeEntryId}`)
  
  revalidatePath('/')
  revalidatePath('/salary')
  revalidatePath('/tabel')
  return { success: true }
}

export async function rejectPendingTimeEntry(timeEntryId: number, notificationId: number) {
  // 1. Delete or keep it with is_approved = -1 (rejected). Let's delete it completely.
  db.prepare('DELETE FROM time_entries WHERE id = ?').run(timeEntryId)
  
  // 2. Mark the notification as read
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId)
  
  // 3. Mark matching notifications as read for all other users
  db.prepare('UPDATE notifications SET is_read = 1 WHERE type = ?').run(`time_approval:${timeEntryId}`)
  
  revalidatePath('/')
  revalidatePath('/salary')
  revalidatePath('/tabel')
  return { success: true }
}
