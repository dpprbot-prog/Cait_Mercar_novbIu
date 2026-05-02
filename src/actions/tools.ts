'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'

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

export async function addTool(data: Partial<ToolItem>) {
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
    revalidatePath('/tools')
    return { success: true }
  } catch (e) {
    console.error('initiateTransfer error', e)
    return { success: false }
  }
}

export async function respondToolTransfer(id: string, accept: boolean, transferTo: string, transferToType: string, transferObject: string, issuedToFallback: string | null) {
  try {
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
    }
    revalidatePath('/tools')
    return { success: true }
  } catch(e) {
    console.error('respondTransfer error', e)
    return { success: false }
  }
}

export async function sendToolToRepair(id: string, location: string, date: string) {
  try {
    const stmt = db.prepare(`
      UPDATE tools SET status = 'repair', repair_location = ?, repair_sentDate = ? WHERE id = ?
    `)
    stmt.run(location, date, id)
    revalidatePath('/tools')
    return { success: true }
  } catch(e) { return { success: false } }
}

export async function returnToolFromRepair(id: string) {
  try {
    const stmt = db.prepare(`
      UPDATE tools SET status = 'available', condition = 'good', repair_location = null, repair_sentDate = null WHERE id = ?
    `)
    stmt.run(id)
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
    revalidatePath('/tools')
    return { success: true }
  } catch(e) { return { success: false } }
}

export async function resolveToolWriteOff(id: string, approve: boolean, issuedToFallback: string | null) {
  try {
    if (approve) {
      const stmt = db.prepare(`
        UPDATE tools SET status = 'written_off', assigneeType = null, issuedTo = null, issuedObject = null,
        writeoff_reason = null, writeoff_photo = null, writeoff_requestedBy = null, writeoff_date = null
        WHERE id = ?
      `)
      stmt.run(id)
    } else {
      const status = issuedToFallback ? 'issued' : 'available'
      const stmt = db.prepare(`
        UPDATE tools SET status = ?, 
        writeoff_reason = null, writeoff_photo = null, writeoff_requestedBy = null, writeoff_date = null
        WHERE id = ?
      `)
      stmt.run(status, id)
    }
    revalidatePath('/tools')
    return { success: true }
  } catch (e) { return { success: false } }
}

export async function deleteTool(id: string) {
  try {
    db.prepare('DELETE FROM tools WHERE id = ?').run(id)
    revalidatePath('/tools')
    return { success: true }
  } catch (err) {
    console.error('Failed to delete tool:', err)
    return { success: false }
  }
}
