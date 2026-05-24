'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAction } from './history'
import { getMe } from './auth'

export type PPEStatus = 'active' | 'returned' | 'expired' | 'lost'
export type PPECategory = 'head' | 'hands' | 'feet' | 'body' | 'eyes' | 'hearing' | 'respiratory' | 'fall'

export interface PPEItem {
  id: string
  name: string
  category: PPECategory
  worker: string
  object: string
  issuedDate: string
  expiryDate: string
  qty: number
  unit: string
  status: PPEStatus
  size?: string
  note?: string
  returnedDate?: string
}

export async function getSizItems(): Promise<PPEItem[]> {
  try {
    const stmt = db.prepare('SELECT * FROM siz_items ORDER BY issuedDate DESC')
    return stmt.all() as PPEItem[]
  } catch (error) {
    console.error('Failed to get siz items:', error)
    return []
  }
}

export async function issueSizItem(data: Omit<PPEItem, 'id' | 'status' | 'returnedDate'>, performedBy: string = 'Система') {
  try {
    const userProfile = await getMe()
    if (!userProfile || !['Админ', 'Мастер', 'Склад'].includes(userProfile.role || '')) {
      return { success: false, error: 'Доступ запрещен. Недостаточно прав.' }
    }
    const finalPerformedBy = userProfile.role === 'Админ' || userProfile.role === 'Склад' ? userProfile.role : userProfile.name

    const id = Date.now().toString()
    const stmt = db.prepare(`
      INSERT INTO siz_items 
      (id, name, category, worker, object, issuedDate, expiryDate, qty, unit, status, size, note) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      data.name,
      data.category,
      data.worker,
      data.object,
      data.issuedDate,
      data.expiryDate,
      data.qty,
      data.unit,
      'active',
      data.size || null,
      data.note || null
    )

    await logAction({
      user_name: finalPerformedBy,
      action_type: 'create',
      entity_type: 'siz',
      entity_id: id,
      details: `Выдано СИЗ: ${data.name} -> ${data.worker}`
    })

    revalidatePath('/siz')
    return { success: true, id }
  } catch (error) {
    console.error('Failed to issue SIZ:', error)
    return { success: false, error: 'Failed to issue SIZ item' }
  }
}

export async function updateSizStatus(id: string, status: PPEStatus, returnedDate?: string, performedBy: string = 'Система') {
  try {
    const userProfile = await getMe()
    if (!userProfile || !['Админ', 'Мастер', 'Склад'].includes(userProfile.role || '')) {
      return { success: false, error: 'Доступ запрещен. Недостаточно прав.' }
    }
    const finalPerformedBy = userProfile.role === 'Админ' || userProfile.role === 'Склад' ? userProfile.role : userProfile.name

    const stmt = db.prepare('UPDATE siz_items SET status = ?, returnedDate = ? WHERE id = ?')
    stmt.run(status, returnedDate || null, id)
    
    const siz = db.prepare('SELECT name, worker FROM siz_items WHERE id = ?').get(id) as any
    const labels: any = {returned:'Возвращено',lost:'Утеряно',active:'Активен',expired:'Просрочено'}
    
    await logAction({
      user_name: finalPerformedBy,
      action_type: 'update',
      entity_type: 'siz',
      entity_id: id,
      details: `Смена статуса СИЗ "${siz?.name}" (${siz?.worker}): -> ${labels[status] || status}`
    })

    revalidatePath('/siz')
    return { success: true }
  } catch (error) {
    console.error('Failed to update SIZ status:', error)
    return { success: false, error: 'Failed to update SIZ status' }
  }
}

export async function deleteSizItem(id: string, performedBy: string = 'Система') {
  try {
    const userProfile = await getMe()
    if (!userProfile || !['Админ', 'Мастер', 'Склад'].includes(userProfile.role || '')) {
      return { success: false, error: 'Доступ запрещен. Недостаточно прав.' }
    }
    const finalPerformedBy = userProfile.role === 'Админ' || userProfile.role === 'Склад' ? userProfile.role : userProfile.name

    const siz = db.prepare('SELECT name, worker FROM siz_items WHERE id = ?').get(id) as any
    db.prepare('DELETE FROM siz_items WHERE id = ?').run(id)
    
    await logAction({
      user_name: finalPerformedBy,
      action_type: 'delete',
      entity_type: 'siz',
      entity_id: id,
      details: `Удалена запись СИЗ: ${siz?.name} (${siz?.worker})`
    })

    revalidatePath('/siz')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete SIZ:', error)
    return { success: false }
  }
}

export async function updateSizItem(id: string, data: Partial<PPEItem>, performedBy: string = 'Система') {
  try {
    const userProfile = await getMe()
    if (!userProfile || !['Админ', 'Мастер', 'Склад'].includes(userProfile.role || '')) {
      return { success: false, error: 'Доступ запрещен. Недостаточно прав.' }
    }
    const finalPerformedBy = userProfile.role === 'Админ' || userProfile.role === 'Склад' ? userProfile.role : userProfile.name

    const old = db.prepare('SELECT status FROM siz_items WHERE id = ?').get(id) as any
    
    // Авто-активация если срок продлили
    let finalStatus = data.status || old.status
    if (data.expiryDate && old.status === 'expired') {
      const parts = data.expiryDate.split('.').reverse().join('-')
      if (new Date(parts).getTime() > Date.now()) {
        finalStatus = 'active'
      }
    }

    const stmt = db.prepare(`
      UPDATE siz_items SET 
        name = ?, category = ?, worker = ?, object = ?, issuedDate = ?, expiryDate = ?, qty = ?, unit = ?, size = ?, note = ?, status = ?
      WHERE id = ?
    `)
    
    stmt.run(
      data.name, data.category, data.worker, data.object, data.issuedDate, data.expiryDate, 
      data.qty, data.unit, data.size || null, data.note || null, finalStatus, id
    )
    
    await logAction({
      user_name: finalPerformedBy,
      action_type: 'update',
      entity_type: 'siz',
      entity_id: id,
      details: `Редактирование СИЗ: ${data.name} (${data.worker}). Статус: ${finalStatus}`
    })

    revalidatePath('/siz')
    return { success: true }
  } catch (error) {
    console.error('Failed to update SIZ:', error)
    return { success: false }
  }
}
