'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAction } from './history'

export type ToolStatus = 'available' | 'issued' | 'repair' | 'lost' | 'written_off' | 'pending_transfer' | 'pending_writeoff'
export type ToolCategory = 'power' | 'hand' | 'measuring' | 'lifting' | 'welding' | 'concrete' | 'other'
export type AssigneeType = 'worker' | 'brigade'

export interface ToolItem {
  id: string
  name: string
  category: ToolCategory
  inventoryNum: string
  condition: 'good' | 'fair' | 'bad'
  status: ToolStatus
  assigneeType?: AssigneeType | null
  issuedTo?: string | null
  issuedObject?: string | null
  issuedDate?: string | null
  returnDue?: string | null
  qty: number
  unit: string
  note?: string | null
  
  // Flat transfer info
  transfer_from?: string | null
  transfer_to?: string | null
  transfer_toType?: AssigneeType | null
  transfer_date?: string | null
  transfer_object?: string | null
  
  // Repair
  repair_location?: string | null
  repair_sentDate?: string | null
  
  // Writeoff
  writeoff_reason?: string | null
  writeoff_photo?: string | null
  writeoff_requestedBy?: string | null
  writeoff_date?: string | null
}

export async function getTools(): Promise<ToolItem[]> {
  try {
    const stmt = db.prepare('SELECT * FROM tools ORDER BY id DESC')
    return stmt.all() as ToolItem[]
  } catch (err) {
    console.error('Failed to load tools:', err)
    return []
  }
}

export async function addTool(data: Partial<ToolItem>, performedBy: string = 'Система') {
  try {
    const id = 't' + Date.now().toString()
    const stmt = db.prepare(`
      INSERT INTO tools (
        id, name, category, inventoryNum, condition, status, qty, unit, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id, data.name, data.category, data.inventoryNum, data.condition, data.status, data.qty, data.unit, data.note || null
    )
    
    await logAction({
      user_name: performedBy,
      action_type: 'create',
      entity_type: 'tool',
      entity_id: id,
      details: `Добавлен новый инструмент: ${data.name} (${data.inventoryNum})`
    })

    revalidatePath('/tools')
    return { success: true, id }
  } catch (err) {
    console.error('Failed to add tool:', err)
    return { success: false }
  }
}

export async function initiateToolTransfer(id: string, transferData: {from: string, to: string, toType: AssigneeType, date: string, object?: string}) {
  try {
    const stmt = db.prepare(`
      UPDATE tools SET 
        status = 'pending_transfer',
        transfer_from = ?,
        transfer_to = ?,
        transfer_toType = ?,
        transfer_date = ?,
        transfer_object = ?
      WHERE id = ?
    `)
    stmt.run(transferData.from, transferData.to, transferData.toType, transferData.date, transferData.object || null, id)
    
    const tool = db.prepare('SELECT name FROM tools WHERE id = ?').get(id) as any
    await logAction({
      user_name: transferData.from,
      action_type: 'transfer',
      entity_type: 'tool',
      entity_id: id,
      details: `Запрос на передачу "${tool?.name}": ${transferData.from} → ${transferData.to}`
    })

    revalidatePath('/tools')
    return { success: true }
  } catch (e) {
    console.error('initiateTransfer error', e)
    return { success: false }
  }
}

export async function respondToolTransfer(id: string, accept: boolean, transferTo: string, transferToType: string, transferObject: string, issuedToFallback: string | null, performedBy: string = 'Система') {
  try {
    const tool = db.prepare('SELECT name FROM tools WHERE id = ?').get(id) as any
    if (accept) {
      if (transferTo === 'Склад') {
        const stmt = db.prepare(`
          UPDATE tools SET 
            status = 'available', assigneeType = null, issuedTo = null, issuedObject = null,
            transfer_from = null, transfer_to = null, transfer_toType = null, transfer_date = null, transfer_object = null
          WHERE id = ?
        `)
        stmt.run(id)
      } else {
        const d = new Date().toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'.')
        const stmt = db.prepare(`
          UPDATE tools SET 
            status = 'issued', assigneeType = ?, issuedTo = ?, issuedObject = ?, issuedDate = ?,
            transfer_from = null, transfer_to = null, transfer_toType = null, transfer_date = null, transfer_object = null
          WHERE id = ?
        `)
        stmt.run(transferToType, transferTo, transferObject, d, id)
      }
      await logAction({
        user_name: performedBy,
        action_type: 'transfer',
        entity_type: 'tool',
        entity_id: id,
        details: `Передача "${tool?.name}" принята: новый владелец ${transferTo}`
      })
    } else {
      // Reject
      const status = issuedToFallback ? 'issued' : 'available'
      const stmt = db.prepare(`
        UPDATE tools SET 
          status = ?, 
          transfer_from = null, transfer_to = null, transfer_toType = null, transfer_date = null, transfer_object = null
        WHERE id = ?
      `)
      stmt.run(status, id)
      await logAction({
        user_name: performedBy,
        action_type: 'transfer',
        entity_type: 'tool',
        entity_id: id,
        details: `Передача "${tool?.name}" отклонена`
      })
    }
    revalidatePath('/tools')
    return { success: true }
  } catch(e) {
    console.error('respondTransfer error', e)
    return { success: false }
  }
}

export async function sendToolToRepair(id: string, location: string, date: string, performedBy: string = 'Система') {
  try {
    const stmt = db.prepare(`
      UPDATE tools SET status = 'repair', repair_location = ?, repair_sentDate = ? WHERE id = ?
    `)
    stmt.run(location, date, id)
    
    const tool = db.prepare('SELECT name FROM tools WHERE id = ?').get(id) as any
    await logAction({
      user_name: performedBy,
      action_type: 'repair',
      entity_type: 'tool',
      entity_id: id,
      details: `Инструмент "${tool?.name}" отправлен в ремонт (${location})`
    })

    revalidatePath('/tools')
    return { success: true }
  } catch(e) { return { success: false } }
}

export async function returnToolFromRepair(id: string, performedBy: string = 'Система') {
  try {
    const stmt = db.prepare(`
      UPDATE tools SET status = 'available', condition = 'good', repair_location = null, repair_sentDate = null WHERE id = ?
    `)
    stmt.run(id)
    
    const tool = db.prepare('SELECT name FROM tools WHERE id = ?').get(id) as any
    await logAction({
      user_name: performedBy,
      action_type: 'repair',
      entity_type: 'tool',
      entity_id: id,
      details: `Инструмент "${tool?.name}" возвращен из ремонта на склад`
    })

    revalidatePath('/tools')
    return { success: true }
  } catch(e) { return { success: false } }
}

export async function requestToolWriteOff(id: string, reason: string, photo: string | null, requestedBy: string, date: string) {
  try {
    const stmt = db.prepare(`
      UPDATE tools SET status = 'pending_writeoff', writeoff_reason = ?, writeoff_photo = ?, writeoff_requestedBy = ?, writeoff_date = ?
      WHERE id = ?
    `)
    stmt.run(reason, photo, requestedBy, date, id)
    
    const tool = db.prepare('SELECT name FROM tools WHERE id = ?').get(id) as any
    await logAction({
      user_name: requestedBy,
      action_type: 'writeoff',
      entity_type: 'tool',
      entity_id: id,
      details: `Заявка на списание "${tool?.name}". Причина: ${reason}`
    })

    revalidatePath('/tools')
    return { success: true }
  } catch(e) { return { success: false } }
}

export async function resolveToolWriteOff(id: string, approve: boolean, issuedToFallback: string | null, performedBy: string = 'Система') {
  try {
    const tool = db.prepare('SELECT name FROM tools WHERE id = ?').get(id) as any
    if (approve) {
      const stmt = db.prepare(`
        UPDATE tools SET status = 'written_off', assigneeType = null, issuedTo = null, issuedObject = null,
        writeoff_reason = null, writeoff_photo = null, writeoff_requestedBy = null, writeoff_date = null
        WHERE id = ?
      `)
      stmt.run(id)
      await logAction({
        user_name: performedBy,
        action_type: 'writeoff',
        entity_type: 'tool',
        entity_id: id,
        details: `Списание "${tool?.name}" ОДОБРЕНО`
      })
    } else {
      const status = issuedToFallback ? 'issued' : 'available'
      const stmt = db.prepare(`
        UPDATE tools SET status = ?, 
        writeoff_reason = null, writeoff_photo = null, writeoff_requestedBy = null, writeoff_date = null
        WHERE id = ?
      `)
      stmt.run(status, id)
      await logAction({
        user_name: performedBy,
        action_type: 'writeoff',
        entity_type: 'tool',
        entity_id: id,
        details: `Списание "${tool?.name}" ОТКЛОНЕНО`
      })
    }
    revalidatePath('/tools')
    return { success: true }
  } catch (e) { return { success: false } }
}

export async function deleteTool(id: string, performedBy: string = 'Система') {
  try {
    const tool = db.prepare('SELECT name, inventoryNum FROM tools WHERE id = ?').get(id) as any
    db.prepare('DELETE FROM tools WHERE id = ?').run(id)
    
    await logAction({
      user_name: performedBy,
      action_type: 'delete',
      entity_type: 'tool',
      entity_id: id,
      details: `Удален инструмент: ${tool?.name} (${tool?.inventoryNum})`
    })

    revalidatePath('/tools')
    return { success: true }
  } catch (err) {
    console.error('Failed to delete tool:', err)
    return { success: false }
  }
}

export async function updateTool(id: string, data: Partial<ToolItem>, performedBy: string = 'Система') {
  try {
    const old = db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as any
    const stmt = db.prepare(`
      UPDATE tools SET 
        name = ?, category = ?, inventoryNum = ?, condition = ?, qty = ?, unit = ?, note = ?
      WHERE id = ?
    `)
    stmt.run(data.name, data.category, data.inventoryNum, data.condition, data.qty, data.unit, data.note || null, id)
    
    let changes = []
    if (old.name !== data.name) changes.push(`название: ${old.name} -> ${data.name}`)
    if (old.inventoryNum !== data.inventoryNum) changes.push(`инв. №: ${old.inventoryNum} -> ${data.inventoryNum}`)
    if (old.condition !== data.condition) changes.push(`состояние: ${old.condition} -> ${data.condition}`)
    if (old.qty !== data.qty) changes.push(`кол-во: ${old.qty} -> ${data.qty}`)

    await logAction({
      user_name: performedBy,
      action_type: 'update',
      entity_type: 'tool',
      entity_id: id,
      details: `Редактирование "${data.name}". Изменено: ${changes.join(', ') || 'без изменений'}`
    })

    revalidatePath('/tools')
    return { success: true }
  } catch (err) {
    console.error('Failed to update tool:', err)
    return { success: false }
  }
}
