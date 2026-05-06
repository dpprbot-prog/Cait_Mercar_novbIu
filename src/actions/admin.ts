'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hashPassword } from './auth'
import { logAction } from './history'

async function checkAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'Админ') {
    throw new Error('Доступ запрещен')
  }
}

export async function updateWorkerAdmin(workerId: string, data: {
  login: string,
  last_name: string,
  first_name: string,
  patronymic?: string,
  role: string,
  brigade_id?: string | null,
  height?: number | null,
  clothing_size?: string | null,
  shoe_size?: string | null,
  is_blocked?: number,
  passwordStr?: string
}) {
  try {
    await checkAdmin()
    
    const name = `${data.last_name} ${data.first_name[0]}.`
    
    db.prepare(`
      UPDATE workers 
      SET login = ?, last_name = ?, first_name = ?, patronymic = ?, name = ?, role = ?, brigade_id = ?, 
          height = ?, clothing_size = ?, shoe_size = ?, is_blocked = COALESCE(?, is_blocked),
          password_hash = COALESCE(?, password_hash)
      WHERE id = ?
    `).run(
      data.login,
      data.last_name, 
      data.first_name, 
      data.patronymic || '', 
      name, 
      data.role, 
      data.brigade_id || null,
      data.height || null, 
      data.clothing_size || null, 
      data.shoe_size || null,
      data.is_blocked !== undefined ? data.is_blocked : null,
      data.passwordStr ? await hashPassword(data.passwordStr) : null, 
      workerId
    )
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'worker',
      entity_id: workerId,
      details: `Обновление данных сотрудника: ${data.last_name} ${data.first_name}`
    })
    
    revalidatePath('/employees')
    return { success: true }
  } catch (error: any) {
    console.error('Update worker error:', error)
    return { success: false, error: error.message || 'Ошибка обновления' }
  }
}

export async function deleteWorker(workerId: string) {
  try {
    await checkAdmin()
    
    if (workerId === 'admin') {
      return { success: false, error: 'Нельзя удалить главного администратора' }
    }

    const worker = db.prepare('SELECT last_name, first_name FROM workers WHERE id = ?').get(workerId) as any
    db.prepare('DELETE FROM workers WHERE id = ?').run(workerId)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'delete',
      entity_type: 'worker',
      entity_id: workerId,
      details: `Удаление сотрудника: ${worker?.last_name} ${worker?.first_name}`
    })
    
    revalidatePath('/employees')
    return { success: true }
  } catch (error: any) {
    console.error('Delete worker error:', error)
    return { success: false, error: error.message || 'Ошибка удаления' }
  }
}

export async function toggleWorkerBlock(workerId: string) {
  try {
    await checkAdmin()
    
    if (workerId === 'admin') {
      return { success: false, error: 'Нельзя заблокировать главного администратора' }
    }

    const worker = db.prepare('SELECT is_blocked FROM workers WHERE id = ?').get(workerId) as { is_blocked: number } | undefined
    if (!worker) return { success: false, error: 'Сотрудник не найден' }

    const newStatus = worker.is_blocked ? 0 : 1
    db.prepare('UPDATE workers SET is_blocked = ? WHERE id = ?').run(newStatus, workerId)

    if (newStatus === 1) {
      // Принудительный логаут: удаляем все сессии
      db.prepare('DELETE FROM sessions WHERE worker_id = ?').run(workerId)
    }

    const admin = await getCurrentUser()
    const w = db.prepare('SELECT last_name, first_name FROM workers WHERE id = ?').get(workerId) as any
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'worker',
      entity_id: workerId,
      details: `${newStatus === 1 ? 'Блокировка' : 'Разблокировка'} сотрудника: ${w?.last_name} ${w?.first_name}`
    })

    revalidatePath('/employees')
    return { success: true, newStatus }
  } catch (error: any) {
    console.error('Toggle block error:', error)
    return { success: false, error: error.message || 'Ошибка блокировки' }
  }
}

export async function addObject(name: string) {
  try {
    await checkAdmin()
    
    const id = 'obj' + Date.now()
    db.prepare('INSERT INTO objects (id, name) VALUES (?, ?)').run(id, name)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'create',
      entity_type: 'object',
      entity_id: id,
      details: `Добавлен новый объект: ${name}`
    })
    
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    console.error('Add object error:', error)
    return { success: false, error: error.message || 'Ошибка добавления' }
  }
}

export async function deleteObject(name: string) {
  try {
    await checkAdmin()
    
    db.prepare('DELETE FROM objects WHERE name = ?').run(name)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'delete',
      entity_type: 'object',
      entity_id: name,
      details: `Удален объект: ${name}`
    })
    
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    console.error('Delete object error:', error)
    return { success: false, error: error.message || 'Ошибка удаления' }
  }
}

export async function updateObject(oldName: string, newName: string) {
  try {
    await checkAdmin()
    db.prepare('UPDATE objects SET name = ? WHERE name = ?').run(newName, oldName)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'object',
      entity_id: newName,
      details: `Объект переименован: ${oldName} -> ${newName}`
    })
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    console.error('Update object error:', error)
    return { success: false, error: error.message || 'Ошибка обновления' }
  }
}

// ── BRIGADES ─────────────────────────────────────────────

export async function addBrigade(name: string) {
  try {
    await checkAdmin()
    const id = 'b' + Date.now()
    db.prepare('INSERT INTO brigades (id, name, pot_amount) VALUES (?, ?, 0)').run(id, name)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'create',
      entity_type: 'brigade',
      entity_id: id,
      details: `Создана бригада: ${name}`
    })
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateBrigade(id: string, name: string, potAmount: number) {
  try {
    await checkAdmin()
    db.prepare('UPDATE brigades SET name = ?, pot_amount = ? WHERE id = ?').run(name, potAmount, id)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'brigade',
      entity_id: id,
      details: `Обновление бригады: ${name} (Общак: ${potAmount})`
    })
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteBrigade(id: string) {
  try {
    await checkAdmin()
    // Обнуляем принадлежность сотрудников перед удалением бригады
    db.prepare('UPDATE workers SET brigade_id = NULL WHERE brigade_id = ?').run(id)
    const b = db.prepare('SELECT name FROM brigades WHERE id = ?').get(id) as any
    db.prepare('DELETE FROM brigades WHERE id = ?').run(id)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'delete',
      entity_type: 'brigade',
      entity_id: id,
      details: `Удалена бригада: ${b?.name}`
    })
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function setWorkerBrigade(workerId: string, brigadeId: string | null) {
  try {
    await checkAdmin()
    db.prepare('UPDATE workers SET brigade_id = ? WHERE id = ?').run(brigadeId, workerId)
    
    const admin = await getCurrentUser()
    const w = db.prepare('SELECT last_name, first_name FROM workers WHERE id = ?').get(workerId) as any
    const b = brigadeId ? (db.prepare('SELECT name FROM brigades WHERE id = ?').get(brigadeId) as any)?.name : 'нет'
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'worker',
      entity_id: workerId,
      details: `Смена бригады у ${w?.last_name} ${w?.first_name}: ${b}`
    })
    revalidatePath('/objects')
    revalidatePath('/employees')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── STORES ─────────────────────────────────────────────

export async function addStore(name: string, address: string = '', phone: string = '') {
  try {
    await checkAdmin()
    const id = 's' + Date.now()
    db.prepare('INSERT INTO stores (id, name, address, phone) VALUES (?, ?, ?, ?)').run(id, name, address, phone)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'create',
      entity_type: 'store',
      entity_id: id,
      details: `Добавлен магазин: ${name}`
    })
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateStore(id: string, name: string, address: string, phone: string) {
  try {
    await checkAdmin()
    db.prepare('UPDATE stores SET name = ?, address = ?, phone = ? WHERE id = ?').run(name, address, phone, id)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'store',
      entity_id: id,
      details: `Обновлен магазин: ${name}`
    })
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteStore(id: string) {
  try {
    await checkAdmin()
    const s = db.prepare('SELECT name FROM stores WHERE id = ?').get(id) as any
    db.prepare('DELETE FROM stores WHERE id = ?').run(id)
    
    const admin = await getCurrentUser()
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'delete',
      entity_type: 'store',
      entity_id: id,
      details: `Удален магазин: ${s?.name}`
    })
    revalidatePath('/objects')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
export async function approveWorker(workerId: string, data: { role: string, brigade_id?: string | null }) {
  try {
    await checkAdmin()
    db.prepare('UPDATE workers SET is_approved = 1, role = ?, brigade_id = ? WHERE id = ?')
      .run(data.role, data.brigade_id || null, workerId)
    
    const admin = await getCurrentUser()
    const w = db.prepare('SELECT last_name, first_name FROM workers WHERE id = ?').get(workerId) as any
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'worker',
      entity_id: workerId,
      details: `Одобрен новый сотрудник: ${w?.last_name} ${w?.first_name} (Роль: ${data.role})`
    })
    revalidatePath('/employees')
    return { success: true }
  } catch (error: any) {
    console.error('Approve worker error:', error)
    return { success: false, error: error.message || 'Ошибка одобрения' }
  }
}
