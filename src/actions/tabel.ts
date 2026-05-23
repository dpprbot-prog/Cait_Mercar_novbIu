'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'

// Типы для возвращаемых данных
export interface WorkerWithEntry {
  id: string
  userName: string
  userRole: string
  userColor: string
  initials: string
  brigadeId: string
  object: string
  startTime: string
  endTime: string
  lunchMin: number
  hoursTotal: number
  isApproved?: number
}




// Получить рабочих конкретной бригады и их отметки времени за указанную дату
export async function getBrigadeWorkersWithEntries(brigadeId: string, date: string): Promise<WorkerWithEntry[]> {
  const rows = db.prepare(`
    SELECT 
      w.id, w.name as userName, w.role as userRole, w.user_color as userColor, w.initials, w.brigade_id as brigadeId,
      t.object_id as object, t.start_time as startTime, t.end_time as endTime, t.lunch_min as lunchMin, t.hours_total as hoursTotal, t.is_approved as isApproved
    FROM workers w
    LEFT JOIN time_entries t ON w.id = t.worker_id AND t.date = ?
    WHERE w.brigade_id = ?
    ORDER BY w.name
  `).all(date, brigadeId) as any[]

  return rows.map(r => ({
    id: r.id,
    userName: r.userName,
    userRole: r.userRole,
    userColor: r.userColor,
    initials: r.initials,
    brigadeId: r.brigadeId,
    object: r.object || '',
    startTime: r.startTime || '',
    endTime: r.endTime || '',
    lunchMin: r.lunchMin || 0,
    hoursTotal: r.hoursTotal || 0,
    isApproved: r.isApproved ?? 1
  }))
}

// Сохранить отметку времени для работника (текущего "пользователя")
export async function saveTimeEntry(data: {
  workerId: string, 
  brigadeId: string, 
  date: string, 
  object: string, 
  startTime: string, 
  endTime: string, 
  lunchMin: number, 
  hoursTotal: number
}) {
  const worker = db.prepare('SELECT role, name FROM workers WHERE id = ?').get(data.workerId) as { role: string, name: string } | undefined
  const todayStr = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  
  const isPastDay = data.date !== todayStr
  const isRegularWorker = !(worker?.role === 'Админ' || worker?.role === 'Мастер' || worker?.role === 'Бригадир')
  const isApproved = (isPastDay && isRegularWorker) ? 0 : 1

  // Проверяем, есть ли уже запись на эту дату для этого работника
  const existing = db.prepare('SELECT id FROM time_entries WHERE worker_id = ? AND date = ?').get(data.workerId, data.date) as { id: number } | undefined

  let entryId: number
  if (existing) {
    db.prepare(`
      UPDATE time_entries 
      SET object_id = ?, start_time = ?, end_time = ?, lunch_min = ?, hours_total = ?, brigade_id = ?, is_approved = ?
      WHERE id = ?
    `).run(data.object, data.startTime, data.endTime, data.lunchMin, data.hoursTotal, data.brigadeId, isApproved, existing.id)
    entryId = existing.id
  } else {
    const info = db.prepare(`
      INSERT INTO time_entries (worker_id, brigade_id, object_id, date, start_time, end_time, lunch_min, hours_total, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.workerId, data.brigadeId, data.object, data.date, data.startTime, data.endTime, data.lunchMin, data.hoursTotal, isApproved)
    entryId = Number(info.lastInsertRowid)
  }

  // Если требует одобрения, отправляем уведомления
  if (isApproved === 0) {
    const approvers = db.prepare("SELECT id FROM workers WHERE role IN ('Админ', 'Мастер')").all() as { id: string }[]
    const objectRow = db.prepare("SELECT name FROM objects WHERE id = ?").get(data.object) as { name: string } | undefined
    const objLabel = objectRow?.name || data.object
    
    approvers.forEach(appr => {
      db.prepare('INSERT INTO notifications (worker_id, type, title, message) VALUES (?, ?, ?, ?)')
        .run(
          appr.id, 
          `time_approval:${entryId}`, 
          'Подтверждение часов', 
          `Сотрудник ${worker?.name || ''} хочет внести/изменить рабочее время за ${data.date} на объекте "${objLabel}" (${data.hoursTotal} ч).`
        )
    })
  }

  revalidatePath('/tabel')
  return { success: true }
}

// Получить историю для работника
export async function getWorkerHistory(workerId: string, limit = 30) {
  return db.prepare(`
    SELECT date, object_id as object, hours_total as hours
    FROM time_entries 
    WHERE worker_id = ? AND hours_total > 0
    ORDER BY date DESC
    LIMIT ?
  `).all(workerId, limit) as { date: string, object: string, hours: number }[]
}
